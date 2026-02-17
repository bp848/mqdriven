
import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log('Approval reminder function started');

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization')
        if (authHeader && authHeader.split(' ')[1] !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

        // 1. Get pending applications due for reminder
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
            .eq('status', 'pending_approval')

        if (error) {
            console.error('Error fetching applications:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 })
        }

        if (!applications || applications.length === 0) {
            return new Response(JSON.stringify({ message: 'No pending applications found.' }), { status: 200 })
        }

        const dueApplications = applications.filter((app: any) => {
            if (!app.last_reminded_at) return true
            return new Date(app.last_reminded_at) <= new Date(twoHoursAgo)
        })

        console.log(`Found ${dueApplications.length} applications due for reminder.`)
        const results = []

        for (const app of dueApplications) {
            let approverId = app.approver_id

            // If approver_id is not set, try to resolve from route steps
            if (!approverId && app.approval_route_id && app.current_level) {
                const { data: routeData, error: routeError } = await supabase
                    .from('approval_steps')
                    .select('approver_id')
                    .eq('approval_route_id', app.approval_route_id)
                    .eq('step_number', app.current_level)
                    .single()

                if (!routeError && routeData) {
                    approverId = routeData.approver_id
                }
            }

            if (!approverId) {
                console.warn(`Could not determine approver for application ${app.id}`)
                results.push({ id: app.id, status: 'skipped', reason: 'no_approver_id' })
                continue
            }

            // Get approver email
            const { data: approver, error: userError } = await supabase
                .from('users')
                .select('email, name')
                .eq('id', approverId)
                .single()

            if (userError || !approver || !approver.email) {
                console.warn(`Could not find email for approver ${approverId}`)
                results.push({ id: app.id, status: 'skipped', reason: 'approver_email_not_found' })
                continue
            }

            const appName = app.application_code?.name || '申請'
            const applicantName = app.applicant?.name || '不明'
            const subject = `【リマインダー】${appName}の承認をお願いします`
            const body = `${approver.name} 様\n\n以下の申請が承認待ち（${app.current_level}段階目）のままとなっております。\n\n申請種別: ${appName}\n申請者: ${applicantName}\n申請ID: ${app.id}\n\n早急なご対応をお願いいたします。\n\n※このメールは承認待ちが続いている場合に自動送信されています。`

            // Call send-application-email function to handle actual sending
            // We use invoke to leverage existing SMTP/Resend setup
            const { error: invokeError } = await supabase.functions.invoke('send-application-email', {
                body: {
                    to: [approver.email],
                    subject: subject,
                    body: body
                }
            })

            if (invokeError) {
                console.error(`Failed to invoke email function for app ${app.id}:`, invokeError)
                results.push({ id: app.id, status: 'failed', reason: 'email_invoke_error' })
            } else {
                console.log(`Reminder sent to ${approver.email} for app ${app.id}`)
                // Update last_reminded_at
                await supabase
                    .from('applications')
                    .update({ last_reminded_at: new Date().toISOString() })
                    .eq('id', app.id)
                results.push({ id: app.id, status: 'sent', recipient: approver.email })
            }
        }

        return new Response(JSON.stringify({ processed: results.length, details: results }), { headers: { 'Content-Type': 'application/json' } })

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})
