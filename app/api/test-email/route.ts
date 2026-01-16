import { NextRequest, NextResponse } from 'next/server';

interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  useSSL: boolean;
  testEmail: string;
}

export async function POST(request: NextRequest) {
  try {
    const settings: EmailSettings = await request.json();
    
    if (!settings.smtpUsername || !settings.smtpPassword || !settings.testEmail) {
      return NextResponse.json(
        { error: 'SMTP設定とテストメールアドレスを入力してください' },
        { status: 400 }
      );
    }

    // Create test email content
    const subject = 'テストメール';
    const body = `
これはSMTP設定のテストメールです。

設定内容:
- SMTPホスト: ${settings.smtpHost}
- ポート: ${settings.smtpPort}
- ユーザー名: ${settings.smtpUsername}
- SSL/TLS: ${settings.useSSL ? '有効' : '無効'}

このメールが正常に受信できれば、メール通知設定は完了です。
    `.trim();

    // Send test email using nodemailer
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.useSSL, // SSL/TLS
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword,
      },
    });

    const mailOptions = {
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: settings.testEmail,
      subject: subject,
      text: body,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { 
        success: true,
        message: 'テストメールを送信しました。確認してください。'
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { 
        error: '送信失敗',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
