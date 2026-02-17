const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Warning: Supabase environment variables are missing for approval reminder job.");
}

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Helper to resolve email endpoint
const getEmailEndpoint = () => {
    const direct = process.env.APPLICATION_EMAIL_ENDPOINT;
    if (direct) return direct;
    if (supabaseUrl) return `${supabaseUrl}/functions/v1/send-application-email`;
    return null;
};

const sendEmail = async (to, subject, body, apiKey) => {
    const endpoint = getEmailEndpoint();
    if (!endpoint) {
        console.error('[Reminder] Email endpoint not configured');
        return false;
    }

    try {
        const response = await axios.post(
            endpoint,
            { to: [to], subject, body },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'apikey': apiKey
                }
            }
        );
        return response.status >= 200 && response.status < 300;
    } catch (error) {
        console.error('[Reminder] Failed to send email', error.message);
        return false;
    }
};

const checkAndSendReminders = async () => {
    console.log('[Reminder] Starting approval reminder check...');
    if (!supabase) {
        console.error('[Reminder] Supabase client not initialized');
        return;
    }

    try {
        // 1. Get pending applications due for reminder
        // Condition: status is pending_approval, and last_reminded_at is older than 2 hours or null
        // Note: Supabase JS doesn't support complex interval queries easily in select, so we filter in JS or use raw query if needed.
        // For simplicity, we fetch pending ones and filter.
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

        const { data: applications, error } = await supabase
            .from('applications')
            .select(`
        id,
        status,
        current_level,
        approver_id,
        approval_route_id,
        last_reminded_at,
        applicant:applicant_id (name),
        application_code:application_code_id (name, code)
      `)
            .eq('status', 'pending_approval');

        if (error) throw error;

        if (!applications || applications.length === 0) {
            console.log('[Reminder] No pending applications found.');
            return;
        }

        const dueApplications = applications.filter(app => {
            if (!app.last_reminded_at) return true;
            return new Date(app.last_reminded_at) <= new Date(twoHoursAgo);
        });

        console.log(`[Reminder] Found ${dueApplications.length} applications due for reminder.`);

        for (const app of dueApplications) {
            try {
                let approverId = app.approver_id;

                // If approver_id is not set, try to resolve from route steps
                if (!approverId && app.approval_route_id && app.current_level) {
                    const { data: routeData, error: routeError } = await supabase
                        .from('approval_steps')
                        .select('approver_id')
                        .eq('approval_route_id', app.approval_route_id)
                        .eq('step_number', app.current_level)
                        .single();

                    if (!routeError && routeData) {
                        approverId = routeData.approver_id;
                    }
                }

                if (!approverId) {
                    console.warn(`[Reminder] Could not determine approver for application ${app.id}`);
                    continue;
                }

                // Get approver email
                const { data: approver, error: userError } = await supabase
                    .from('users')
                    .select('email, name')
                    .eq('id', approverId)
                    .single();

                if (userError || !approver || !approver.email) {
                    console.warn(`[Reminder] Could not find email for approver ${approverId}`);
                    continue;
                }

                // Send email
                const appName = app.application_code?.name || '申請';
                const applicantName = app.applicant?.name || '不明';
                const subject = `【リマインダー】${appName}の承認をお願いします`;
                const body = `${approver.name} 様\n\n以下の申請が承認待ち（${app.current_level}段階目）のままとなっております。\n\n申請種別: ${appName}\n申請者: ${applicantName}\n申請ID: ${app.id}\n\n早急なご対応をお願いいたします。\n\n※このメールは承認待ちが続いている場合に自動送信されています。`;

                const sent = await sendEmail(approver.email, subject, body, supabaseKey);

                if (sent) {
                    console.log(`[Reminder] Reminder sent to ${approver.email} for app ${app.id}`);
                    // Update last_reminded_at
                    await supabase
                        .from('applications')
                        .update({ last_reminded_at: new Date().toISOString() })
                        .eq('id', app.id);
                }

            } catch (innerError) {
                console.error(`[Reminder] Error processing application ${app.id}:`, innerError);
            }
        }

    } catch (err) {
        console.error('[Reminder] Error in reminder job:', err);
    }
};

module.exports = { checkAndSendReminders };
