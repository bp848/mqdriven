import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rwjhpfghhgstvplmggks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setAdminById() {
  const userId = '4748'; // 指定されたID
  
  console.log(`ユーザーID ${userId} を管理者に設定中...\n`);

  try {
    // IDで検索（部分一致も含む）
    const { data: users, error: searchError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .or(`id.eq.${userId},id.ilike.%${userId}%`);

    if (searchError) {
      console.error('❌ 検索エラー:', searchError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️  該当するユーザーが見つかりません');
      return;
    }

    console.log(`${users.length}件のユーザーが見つかりました:\n`);
    
    for (const user of users) {
      console.log(`ID: ${user.id}`);
      console.log(`名前: ${user.name || '未設定'}`);
      console.log(`メール: ${user.email || '未設定'}`);
      console.log(`現在の役割: ${user.role || '未設定'}\n`);

      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', user.id);

      if (updateError) {
        console.error(`❌ 更新エラー: ${updateError.message}`);
      } else {
        console.log(`✅ 管理者に設定しました\n`);
      }
    }
  } catch (err) {
    console.error('❌ 予期しないエラー:', err);
  }
}

setAdminById();
