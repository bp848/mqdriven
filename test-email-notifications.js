// Test script for email notifications
// This can be run in the browser console to test the notification system

async function testEmailNotifications() {
  console.log('Testing email notification system...');
  
  // Test 1: Load current settings
  const settings = JSON.parse(localStorage.getItem('emailNotificationSettings') || '{}');
  console.log('Current settings:', settings);
  
  // Test 2: Test email sending with current configuration
  try {
    const emailPayload = {
      to: ['test@example.com'],
      subject: '【テスト】メール通知機能テスト',
      body: `これはメール通知機能のテストです。

現在の設定:
- 通知有効: ${settings.enableNotifications !== false ? 'はい' : 'いいえ'}
- SMTPホスト: ${settings.smtp?.host || '未設定'}
- 送信元: ${settings.smtp?.fromEmail || '未設定'}

テスト日時: ${new Date().toLocaleString('ja-JP')}`
    };
    
    console.log('Sending test email with payload:', emailPayload);
    
    // Import and use the sendEmail function (if available in global scope)
    if (typeof window.sendEmail === 'function') {
      const result = await window.sendEmail(emailPayload);
      console.log('Email sent successfully:', result);
    } else {
      console.log('sendEmail function not available in global scope');
      console.log('You can test this through the Email Notification Settings page');
    }
  } catch (error) {
    console.error('Email test failed:', error);
  }
  
  // Test 3: Test notification settings
  const notificationTypes = ['submitted', 'approved', 'rejected', 'step_forward'];
  console.log('Notification type settings:');
  notificationTypes.forEach(type => {
    const enabled = settings.notificationTypes?.[type] !== false;
    console.log(`- ${type}: ${enabled ? '有効' : '無効'}`);
  });
  
  console.log('Test completed. Check the console output above.');
}

// Make the test function available globally
window.testEmailNotifications = testEmailNotifications;

console.log('Email notification test script loaded. Run testEmailNotifications() to test.');
