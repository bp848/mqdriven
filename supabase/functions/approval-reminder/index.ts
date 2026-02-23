
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
        const results = []

        // 1. Application Reminders (Existing Logic)
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
        } else {
            const dueApplications = applications.filter((app: any) => {
                if (!app.last_reminded_at) return true
                return new Date(app.last_reminded_at) <= new Date(twoHoursAgo)
            })

            console.log(`Found ${dueApplications.length} applications due for reminder.`)

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
                    results.push({ id: app.id, type: 'application', status: 'skipped', reason: 'no_approver_id' })
                    continue
                }

                // Get approver email
                const { data: approver, error: userError } = await supabase
                    .from('users')
                    .select('email, name, notification_enabled')
                    .eq('id', approverId)
                    .single()

                if (userError || !approver || !approver.email) {
                    console.warn(`Could not find email for approver ${approverId}`)
                    results.push({ id: app.id, type: 'application', status: 'skipped', reason: 'approver_email_not_found' })
                    continue
                }

                if (approver.notification_enabled === false) {
                    console.log(`Approver ${approver.name} has disabled notifications. Skipping application reminder.`);
                    results.push({ id: app.id, type: 'application', status: 'skipped', reason: 'notification_disabled' })
                    continue
                }

                const appName = app.application_code?.name || '申請'
                const applicantName = app.applicant?.name || '不明'
                const subject = `【リマインダー】${appName}の承認をお願いします`
                const body = `${approver.name} 様\n\n以下の申請が承認待ち（${app.current_level}段階目）のままとなっております。\n\n申請種別: ${appName}\n申請者: ${applicantName}\n申請ID: ${app.id}\n\n早急なご対応をお願いいたします。\n\n※このメールは承認待ちが続いている場合に自動送信されています。`

                const { error: invokeError } = await supabase.functions.invoke('send-application-email', {
                    body: {
                        to: [approver.email],
                        subject: subject,
                        body: body
                    }
                })

                if (invokeError) {
                    console.error(`Failed to invoke email function for app ${app.id}:`, invokeError)
                    results.push({ id: app.id, type: 'application', status: 'failed', reason: 'email_invoke_error' })
                } else {
                    console.log(`Reminder sent to ${approver.email} for app ${app.id}`)
                    await supabase
                        .from('applications')
                        .update({ last_reminded_at: new Date().toISOString() })
                        .eq('id', app.id)
                    results.push({ id: app.id, type: 'application', status: 'sent', recipient: approver.email })
                }
            }
        }

        // 2. Project Reminders (New Logic: Overdue & Uninvoiced)
        // Call the RPC function we created in migration
        const { data: projectReminders, error: rpcError } = await supabase.rpc('get_project_reminders')

        if (rpcError) {
            console.error('Error fetching project reminders:', rpcError)
        } else if (projectReminders && projectReminders.length > 0) {
            console.log(`Found ${projectReminders.length} project reminders.`)

            for (const proj of projectReminders) {
                if (!proj.user_email) {
                    console.warn(`No email found for project reminder: ${proj.id}`)
                    results.push({ id: proj.id, type: 'project', subtype: proj.reminder_type, status: 'skipped', reason: 'no_email' })
                    continue
                }

                let subject = ''
                let body = ''
                const userName = proj.user_name || '担当者'

                if (proj.reminder_type === 'overdue') {
                    subject = `【期限切れ警告】案件「${proj.project_name}」の期限が過ぎています`
                    body = `${userName} 様\n\n以下の案件が期限（${proj.days_overdue}日経過）を過ぎていますが、完了ステータスになっていません。\n\n案件名: ${proj.project_name}\n\n状況を確認し、完了報告または期限の変更を行ってください。`
                } else if (proj.reminder_type === 'uninvoiced') {
                    subject = `【請求書未発行】案件「${proj.project_name}」の請求書が未発行です`
                    body = `${userName} 様\n\n以下の案件は完了していますが、請求書がまだ作成されていないようです（${proj.days_overdue}日経過）。\n\n案件名: ${proj.project_name}\n\n請求漏れを防ぐため、早急に請求書の作成をお願いいたします。`
                }

                const { error: invokeError } = await supabase.functions.invoke('send-application-email', {
                    body: {
                        to: [proj.user_email],
                        subject: subject,
                        body: body
                    }
                })

                if (invokeError) {
                    console.error(`Failed to send project reminder for ${proj.id}:`, invokeError)
                    results.push({ id: proj.id, type: 'project', subtype: proj.reminder_type, status: 'failed', reason: 'email_invoke_error' })
                } else {
                    console.log(`Project reminder sent to ${proj.user_email} for project ${proj.id}`)
                    // Update last_reminded_at
                    await supabase
                        .from('projects')
                        .update({ last_reminded_at: new Date().toISOString() })
                        .eq('id', proj.id)

                    results.push({ id: proj.id, type: 'project', subtype: proj.reminder_type, status: 'sent', recipient: proj.user_email })
                }
            }
        }

        return new Response(JSON.stringify({ processed: results.length, details: results }), { headers: { 'Content-Type': 'application/json' } })

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})
