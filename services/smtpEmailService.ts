interface EmailSettings {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  useSSL: boolean;
  notificationTypes: {
    onSubmit: boolean;
    onApprove: boolean;
    onReject: boolean;
    onNextStep: boolean;
  };
}

interface EmailPayload {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body?: string;
  html?: string;
}

class SMTPEmailService {
  private settings: EmailSettings | null = null;

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('emailNotificationSettings');
      if (savedSettings) {
        try {
          this.settings = JSON.parse(savedSettings);
        } catch (e) {
          console.error('Failed to load email settings:', e);
          this.settings = null;
        }
      }
    }
  }

  private normalizeEmails = (values: unknown): string[] => {
    const list = Array.isArray(values)
      ? values
      : typeof values === "string"
      ? values.split(/[,;\n]/)
      : [];
    return list
      .filter((item): item is string => typeof item === "string")
      .map(email => email.trim())
      .filter(email => email.length > 0);
  };

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    // If SMTP is not configured, fall back to Resend
    if (!this.settings || !this.settings.enabled) {
      return this.sendViaResend(payload);
    }

    try {
      const { to, cc, bcc, subject, body, html } = payload;
      
      if (!to || to.length === 0) {
        return { success: false, error: '少なくとも1つの送信先が必要です' };
      }

      // Create nodemailer transporter
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter({
        host: this.settings.smtpHost,
        port: this.settings.smtpPort,
        secure: this.settings.useSSL,
        auth: {
          user: this.settings.smtpUsername,
          pass: this.settings.smtpPassword,
        },
      });

      const mailOptions = {
        from: `"${this.settings.fromName}" <${this.settings.fromEmail}>`,
        to: to.join(', '),
        cc: cc && cc.length > 0 ? cc.join(', ') : undefined,
        bcc: bcc && bcc.length > 0 ? bcc.join(', ') : undefined,
        subject: subject || '通知メール',
        text: body,
        html: html || body,
      };

      await transporter.sendMail(mailOptions);
      return { success: true };

    } catch (error: any) {
      console.error('SMTP Email send error:', error);
      return { 
        success: false, 
        error: error.message || 'メール送信に失敗しました' 
      };
    }
  }

  private async sendViaResend(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/send-application-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { 
          success: false, 
          error: `Resend API error: ${errorText}` 
        };
      }

      return { success: true };

    } catch (error: any) {
      console.error('Resend fallback error:', error);
      return { 
        success: false, 
        error: error.message || 'メール送信に失敗しました' 
      };
    }
  }

  async sendApplicationNotification(
    applicantEmail: string,
    subject: string,
    body: string,
    html?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.settings || !this.settings.enabled) {
      console.log('Email notifications disabled, skipping send');
      return { success: true };
    }

    return this.sendEmail({
      to: [applicantEmail],
      subject,
      body,
      html,
    });
  }

  async sendApprovalNotification(
    applicantEmail: string,
    applicationDetails: any
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.settings || !this.settings.enabled || !this.settings.notificationTypes.onApprove) {
      return { success: true };
    }

    const subject = '申請が承認されました';
    const body = `
申請が承認されました。

申請詳細:
${JSON.stringify(applicationDetails, null, 2)}
    `.trim();

    return this.sendEmail({
      to: [applicantEmail],
      subject,
      body,
    });
  }

  async sendRejectionNotification(
    applicantEmail: string,
    applicationDetails: any,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.settings || !this.settings.enabled || !this.settings.notificationTypes.onReject) {
      return { success: true };
    }

    const subject = '申請が差し戻されました';
    const body = `
申請が差し戻されました。

差し戻し理由:
${reason}

申請詳細:
${JSON.stringify(applicationDetails, null, 2)}
    `.trim();

    return this.sendEmail({
      to: [applicantEmail],
      subject,
      body,
    });
  }
}

export default SMTPEmailService;
