import { createClient } from '@supabase/supabase-js';

// Supabase credentials from supabaseCredentials.ts
const SUPABASE_URL = 'https://rwjhpfghhgstvplmggks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const adminEmails = [
  'ikeya@b-p.co.jp',
  'shoichi@b-p.co.jp'
];

async function setAdminUsers() {
  console.log('管理者権限を設定中...\n');

  for (const email of adminEmails) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('email', email)
        .select();

      if (error) {
        console.error(`❌ ${email}: エラー - ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`✅ ${email}: 管理者に設定しました`);
      } else {
        console.log(`⚠️  ${email}: ユーザーが見つかりません`);
      }
    } catch (err) {
      console.error(`❌ ${email}: 予期しないエラー -`, err);
    }
  }

  console.log('\n完了しました。');
}

setAdminUsers();
