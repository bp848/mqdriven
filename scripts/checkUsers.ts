import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rwjhpfghhgstvplmggks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUsers() {
  console.log('ユーザー情報を確認中...\n');

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('エラー:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('ユーザーが見つかりません');
    return;
  }

  console.log('登録ユーザー一覧:\n');
  data.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email || 'メールなし'}`);
    console.log(`   名前: ${user.name || '未設定'}`);
    console.log(`   役割: ${user.role || '未設定'}`);
    console.log(`   ID: ${user.id}`);
    console.log('');
  });
}

checkUsers();
