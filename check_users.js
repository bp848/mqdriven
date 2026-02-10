const { createClient } = require('@supabase/supabase-js');

// 環境変数の代わりに直接設定（実際の値に置き換えてください）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, is_active, email')
      .order('name');
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    console.log('ユーザーリスト:');
    console.log('='.repeat(50));
    data.forEach(user => {
      console.log(`名前: ${user.name}`);
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email || 'N/A'}`);
      console.log(`is_active: ${user.is_active} (型: ${typeof user.is_active})`);
      console.log('-'.repeat(30));
    });
    
    // 無効ユーザーの確認
    const inactiveUsers = data.filter(user => user.is_active === false);
    console.log(`\n無効ユーザー数: ${inactiveUsers.length}`);
    if (inactiveUsers.length > 0) {
      console.log('無効ユーザー一覧:');
      inactiveUsers.forEach(user => {
        console.log(`- ${user.name} (${user.id})`);
      });
    }
    
  } catch (err) {
    console.error('実行エラー:', err);
  }
}

checkUsers();
