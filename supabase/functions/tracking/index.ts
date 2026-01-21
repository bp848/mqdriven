import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  
  // Handle tracking pixel requests
  if (pathParts[1] === 'api' && pathParts[2] === 'tracking' && pathParts[3] === 'pixel') {
    const emailId = pathParts[4];
    
    if (!emailId) {
      return new Response('Email ID required', { status: 400 });
    }

    try {
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Record email open event
      const { data, error } = await supabase.rpc('track_email_open', { 
        email_id_param: emailId,
        user_agent: req.headers.get('user-agent') || 'Unknown',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown'
      });

      if (error) {
        console.error('Error tracking email open:', error);
        // Don't return error to user, just log it
      }

      // Return 1x1 transparent PNG
      const pngData = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0x99, 0x01, 0x01, 0x01, 0x00, 0x00,
        0xFE, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      return new Response(pngData, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } catch (error) {
      console.error('Error in tracking endpoint:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // Handle email status check requests
  if (pathParts[1] === 'api' && pathParts[2] === 'tracking' && pathParts[3] === 'status') {
    const emailId = pathParts[4];
    
    if (!emailId) {
      return new Response('Email ID required', { status: 400 });
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get email tracking status
      const { data, error } = await supabase
        .from('email_tracking')
        .select('*')
        .eq('email_id', emailId)
        .order('opened_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error getting email status:', error);
        return new Response(JSON.stringify({ error: 'Failed to get email status' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const status = {
        isOpened: data && data.length > 0,
        openedAt: data && data.length > 0 ? data[0].opened_at : null,
        openCount: data ? data.length : 0
      };

      return new Response(JSON.stringify(status), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error in status endpoint:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  return new Response('Not Found', { 
    status: 404,
    headers: corsHeaders
  });
});
