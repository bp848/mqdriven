import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rwjhpfghhgstvplmggks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const adminEmails = [
  'ikeya@b-p.co.jp',
  'shoichi@b-p.co.jp'
];

async function fixDuplicateUsers() {
  console.log('重複ユーザーを確認して管理者権限を設定中...\n');

  for (const email of adminEmails) {
    try {
      // Find all users with this email
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('id, name, email, role, created_at')
        .eq('email', email)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error(`❌ ${email}: エラー - ${fetchError.message}`);
        continue;
      }

      if (!users || users.length === 0) {
        console.log(`⚠️  ${email}: ユーザーが見つかりません`);
        continue;
      }

      console.log(`📧 ${email}: ${users.length}件のレコードが見つかりました`);
      
      // Update ALL records with this email to admin
      for (const user of users) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('id', user.id);

        if (updateError) {
          console.error(`  ❌ ID ${user.id}: 更新エラー - ${updateError.message}`);
        } else {
          console.log(`  ✅ ID ${user.id} (${user.name}): 管理者に設定しました`);
        }
      }
      
      console.log('');
    } catch (err) {
      console.error(`❌ ${email}: 予期しないエラー -`, err);
    }
  }

  console.log('完了しました。');
}

fixDuplicateUsers();
