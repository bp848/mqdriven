import { Application, ApplicationWithDetails } from '../types';
import { getSupabase } from './supabaseClient';
import { sendEmail } from './emailService';
import { formatDateTime } from '../utils';

export type ApprovalNotificationType = 'submitted' | 'approved' | 'rejected' | 'step_forward';

export interface ApprovalNotificationPayload {
    type: ApprovalNotificationType;
    application: Application | ApplicationWithDetails;
    recipientEmail?: string | null;
    recipientUserId?: string | null;
    metadata?: Record<string, any>;
}

type SupabaseClient = ReturnType<typeof getSupabase>;

interface UserSummary {
    id: string;
    name: string | null;
    email: string | null;
}

const userCache = new Map<string, UserSummary>();
const applicationCodeCache = new Map<string, string>();

const SUBJECT_TEMPLATES: Record<ApprovalNotificationType, string> = {
    submitted: '【承認依頼】{code} の申請が提出されました',
    step_forward: '【承認依頼】{code} の承認ステップが割り当てられました',
    approved: '【承認完了】{code} の申請が承認されました',
    rejected: '【差し戻し】{code} の申請が差し戻されました',
};

const BODY_INTRO: Record<ApprovalNotificationType, string> = {
    submitted: '以下の申請が提出されました。承認一覧より内容を確認し、対応をお願いします。',
    step_forward: 'あなたの承認ステップが割り当てられました。内容を確認のうえ承認/差戻しを行ってください。',
    approved: '申請が最終承認されました。完了内容をご確認ください。',
    rejected: '申請が差し戻されました。理由をご確認のうえ再申請をお願いいたします。',
};

const resolveUserById = async (supabase: SupabaseClient, userId?: string | null): Promise<UserSummary | null> => {
    if (!userId) return null;
    if (userCache.has(userId)) {
        return userCache.get(userId)!;
    }
    const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', userId)
        .limit(1)
        .single();

    if (error) {
        console.warn('[notification] ユーザー情報の取得に失敗しました', userId, error);
        return null;
    }
    if (!data) {
        return null;
    }
    userCache.set(userId, data as UserSummary);
    return data as UserSummary;
};

const resolveApplicationCodeName = async (
    supabase: SupabaseClient,
    applicationCodeId?: string | null
): Promise<string | null> => {
    if (!applicationCodeId) return null;
    if (applicationCodeCache.has(applicationCodeId)) {
        return applicationCodeCache.get(applicationCodeId)!;
    }
    const { data, error } = await supabase
        .from('application_codes')
        .select('id, name')
        .eq('id', applicationCodeId)
        .limit(1)
        .single();

    if (error) {
        console.warn('[notification] 申請コード情報の取得に失敗しました', applicationCodeId, error);
        return null;
    }
    if (!data) {
        return null;
    }
    const name = (data as { name?: string | null })?.name ?? null;
    if (name) {
        applicationCodeCache.set(applicationCodeId, name);
    }
    return name;
};

const resolveRecipients = async (supabase: SupabaseClient, payload: ApprovalNotificationPayload): Promise<string[]> => {
    const recipients = new Set<string>();
    if (payload.recipientEmail && payload.recipientEmail.includes('@')) {
        recipients.add(payload.recipientEmail);
    }
    if (payload.recipientUserId) {
        const summary = await resolveUserById(supabase, payload.recipientUserId);
        if (summary?.email) {
            recipients.add(summary.email);
        }
    }
    return Array.from(recipients);
};

const buildApplicantLabel = (application: Application | ApplicationWithDetails, applicant?: UserSummary | null) => {
    if (application && 'applicant' in application && application.applicant?.name) {
        const email = application.applicant?.email ? ` (${application.applicant.email})` : '';
        return `${application.applicant.name}${email}`;
    }
    if (applicant) {
        const email = applicant.email ? ` (${applicant.email})` : '';
        return `${applicant.name ?? '氏名未設定'}${email}`;
    }
    return application.applicantId ?? '不明な申請者';
};

const buildEmailContent = async (
    supabase: SupabaseClient,
    payload: ApprovalNotificationPayload
): Promise<{ subject: string; body: string }> => {
    const application = payload.application;
    const [applicantSummary, applicationCodeName] = await Promise.all([
        resolveUserById(supabase, application.applicantId),
        resolveApplicationCodeName(supabase, application.applicationCodeId),
    ]);

    const codeLabel =
        (application && 'applicationCode' in application && application.applicationCode?.name) ||
        applicationCodeName ||
        application.applicationCodeId ||
        '申請';
    const applicantLabel = buildApplicantLabel(application, applicantSummary);
    const intro = BODY_INTRO[payload.type];

    const details: string[] = [
        `申請ID: ${application.id}`,
        `申請種別: ${codeLabel}`,
        `申請者: ${applicantLabel}`,
        `ステータス: ${application.status}`,
        `承認ルートID: ${application.approvalRouteId ?? '-'}`,
        `現在の承認レベル: ${application.currentLevel ?? '-'}`,
    ];

    if (application.submittedAt) {
        details.push(`申請日時: ${formatDateTime(application.submittedAt)}`);
    }
    if (payload.metadata?.currentLevel) {
        details.push(`次の承認レベル: ${payload.metadata.currentLevel}`);
    }
    if (payload.metadata?.reason) {
        details.push(`差戻し理由: ${payload.metadata.reason}`);
    }
    if (payload.metadata?.approvedAt) {
        details.push(`承認日時: ${formatDateTime(payload.metadata.approvedAt)}`);
    }

    const subjectTemplate = SUBJECT_TEMPLATES[payload.type] ?? '申請通知';
    const subject = subjectTemplate.replace('{code}', codeLabel);

    const lines = [intro, '', ...details, '', '詳細は承認一覧画面で確認できます。'];
    return {
        subject,
        body: lines.join('\n'),
    };
};

export async function sendApprovalNotification(payload: ApprovalNotificationPayload): Promise<void> {
    try {
        const supabase = getSupabase();
        const recipients = await resolveRecipients(supabase, payload);
        if (recipients.length === 0) {
            console.warn('[notification] 送信先メールアドレスが見つからないため通知をスキップしました', payload);
            return;
        }

        const { subject, body } = await buildEmailContent(supabase, payload);
        await sendEmail({
            to: recipients,
            subject,
            body,
        });
    } catch (error) {
        console.error('[notification] 承認通知メールの送信に失敗しました', error);
    }
}
