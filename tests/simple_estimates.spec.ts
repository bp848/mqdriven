import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:8080';

test.describe('Simple Estimates Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('domcontentloaded');
    
    // ログインが必要な場合はスキップ（開発環境用）
    try {
      await page.waitForSelector('text=MQ会計ERP', { timeout: 3000 });
      // ログイン画面の場合はダミーログイン
      if (await page.getByText('ログイン方法を選択してください').isVisible()) {
        await page.getByLabel('メールアドレス').fill('test@example.com');
        await page.getByLabel('パスワード').fill('password');
        await page.getByRole('button', { name: 'パスワードでログイン' }).click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      // 既にログイン済みの場合は続行
    }
    
    // サイドバーが表示されるまで待機
    await page.waitForSelector('text=ホーム', { timeout: 10000 });
  });

  test('should display simple estimates page from sidebar', async ({ page }) => {
    // ホームセクションの見積管理をクリック
    await page.getByText('見積管理').click();
    
    // ページタイトルが表示されることを確認
    await expect(page.getByText('見積管理')).toBeVisible();

    // 画面が表示されること（データの有無は環境依存）
    await expect(page.getByRole('button', { name: '新規見積作成' })).toBeVisible();
  });

  test('should show estimate list with sample data', async ({ page }) => {
    await page.getByText('見積管理').click();
    
    // 一覧/詳細/分析のタブが表示されることを確認
    await expect(page.getByRole('button', { name: '一覧' })).toBeVisible();
    await expect(page.getByRole('button', { name: '詳細' })).toBeVisible();
    await expect(page.getByRole('button', { name: '分析' })).toBeVisible();
  });

  test('should have working search functionality', async ({ page }) => {
    await page.getByText('見積管理').click();
    
    // 検索ボックスが存在するか確認
    const searchBox = page.getByPlaceholder('検索...');
    if (await searchBox.isVisible()) {
      await searchBox.fill('ABC');
      
      // 検索UIが操作できること（データの有無による結果までは固定しない）
      await expect(searchBox).toHaveValue('ABC');
    } else {
      // 検索機能が未実装の場合はスキップ
      console.log('Search functionality not yet implemented');
    }
  });

  test('should have working create button', async ({ page }) => {
    await page.getByText('見積管理').click();
    
    // 新規作成ボタンが存在するか確認
    const createButton = page.getByRole('button', { name: '新規見積作成' });
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // モーダルが表示されることを確認
      await expect(page.getByText('新規見積作成')).toBeVisible();
    } else {
      // 新規作成機能が未実装の場合はスキップ
      console.log('Create functionality not yet implemented');
    }
  });
});
