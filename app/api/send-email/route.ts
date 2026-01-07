import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const emailData = await request.json();
    
    // Validate required fields
    if (!emailData.host || !emailData.auth?.user || !emailData.auth?.pass || !emailData.from || !emailData.to) {
      return NextResponse.json(
        { error: 'Missing required SMTP configuration fields' },
        { status: 400 }
      );
    }

    // For now, just log the email data and return success
    // In a real implementation, you would use a library like nodemailer
    console.log('SMTP Email Configuration:', {
      host: emailData.host,
      port: emailData.port,
      secure: emailData.secure,
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject
    });

    console.log('Email content:', {
      text: emailData.text?.substring(0, 100) + '...',
      html: emailData.html ? 'HTML content present' : 'No HTML content'
    });

    // Simulate successful email sending
    return NextResponse.json({
      id: `smtp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sentAt: new Date().toISOString(),
      message: 'Email sent successfully (simulated)'
    });

  } catch (error) {
    console.error('SMTP send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email via SMTP' },
      { status: 500 }
    );
  }
}
