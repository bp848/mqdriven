// supabase/functions/generate-journal-drafts/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Hello from generate-journal-drafts function!");

// Based on types.ts, but simplified for the function's needs.
interface Application {
  id: string;
  applicant_id: string;
  form_data: any;
  application_code?: {
    code: string;
  };
}

// Helper function to get account IDs
async function getAccountIds(client: SupabaseClient, codes: string[]): Promise<Map<string, string>> {
    const { data, error } = await client
        .from("accounting.accounts")
        .select("id, code")
        .in("code", codes);
    if (error) {
        throw new Error(`Failed to fetch accounts: ${error.message}`);
    }
    const accountIdMap = new Map<string, string>();
    data.forEach(account => {
        accountIdMap.set(account.code, account.id);
    });
    return accountIdMap;
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Fetch account IDs needed for the logic
    const accountCodes = ['1110', '6200']; // 1110: Cash, 6200: Expenses
    const accountIds = await getAccountIds(supabaseAdmin, accountCodes);
    const cashAccountId = accountIds.get('1110');
    const expenseAccountId = accountIds.get('6200');

    if (!cashAccountId || !expenseAccountId) {
        throw new Error("Core accounts (1110, 6200) are not defined in accounting.accounts.");
    }


    // 2. Fetch approved applications that haven't been processed yet.
    const { data: existingBatches, error: batchesError } = await supabaseAdmin
        .from("accounting.journal_batches")
        .select("source_application_id");

    if (batchesError) {
        throw new Error(`Failed to fetch existing journal batches: ${batchesError.message}`);
    }

    const processedApplicationIds = (existingBatches || []).map(
      (batch) => batch.source_application_id
    ).filter(id => id); // Filter out nulls

    const { data: applications, error: applicationsError } = await supabaseAdmin
      .from("applications")
      .select("id, applicant_id, form_data, application_code:application_code_id(code)")
      .eq("status", "approved")
      .not("id", "in", `(${processedApplicationIds.join(",") || "''"})`); // Handle empty array case

    if (applicationsError) {
      throw new Error(`Failed to fetch applications: ${applicationsError.message}`);
    }

    if (!applications || applications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No new approved applications to process." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 3. Process each application in a transaction
    let processedCount = 0;
    for (const app of applications as Application[]) {
        const { id: applicationId, applicant_id, form_data, application_code } = app;

        // Simple logic: only process expense reports for now
        if (application_code?.code !== 'EXP') {
            console.log(`Skipping application ${applicationId} of type ${application_code?.code}.`);
            continue;
        }

        const amount = form_data?.total_amount ?? form_data?.amount ?? 0;
        if (amount <= 0) {
            console.log(`Skipping application ${applicationId} due to zero or invalid amount.`);
            continue;
        }

        // Use Supabase Edge Function's RPC to run a transaction
        const { error: rpcError } = await supabaseAdmin.rpc('create_journal_from_application', {
            p_application_id: applicationId,
            p_applicant_id: applicant_id,
            p_entry_date: form_data?.date || new Date().toISOString().split('T')[0],
            p_description: form_data?.description || '経費精算',
            p_debit_account_id: expenseAccountId,
            p_credit_account_id: cashAccountId,
            p_amount: amount
        });

        if (rpcError) {
            console.error(`Failed to process application ${applicationId}:`, rpcError);
            // Decide if you want to stop or continue on error
        } else {
            processedCount++;
        }
    }

    const responseData = {
      message: `Successfully processed ${processedCount} of ${applications.length} application(s).`,
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500, // Use 500 for internal server errors
    });
  }
});