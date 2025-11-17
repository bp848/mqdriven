import { Application, ApplicationWithDetails } from '../types';

export type ApprovalNotificationType = 'submitted' | 'approved' | 'rejected' | 'step_forward';

export interface ApprovalNotificationPayload {
    type: ApprovalNotificationType;
    application: Application | ApplicationWithDetails;
    recipientEmail?: string | null;
    recipientUserId?: string | null;
    metadata?: Record<string, any>;
}

export async function sendApprovalNotification(payload: ApprovalNotificationPayload): Promise<void> {
    // TODO: Replace this placeholder with an implementation that calls Supabase Functions or Resend.
    console.debug('[approval-notification]', payload.type, {
        applicationId: payload.application.id,
        recipientUserId: payload.recipientUserId,
        recipientEmail: payload.recipientEmail,
        metadata: payload.metadata,
    });
}
