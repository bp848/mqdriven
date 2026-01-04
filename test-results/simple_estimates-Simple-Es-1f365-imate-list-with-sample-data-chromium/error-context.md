# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img [ref=e7]
      - heading "MQ会計ERP" [level=2] [ref=e11]
    - paragraph [ref=e12]: ログイン方法を選択してください
  - generic [ref=e13]:
    - generic [ref=e14]:
      - generic [ref=e15]: メールアドレス
      - textbox "メールアドレス" [ref=e16]:
        - /placeholder: your@company.com
        - text: test@example.com
    - generic [ref=e18]:
      - img [ref=e20]
      - paragraph [ref=e23]: Invalid login credentials
    - generic [ref=e24]:
      - generic [ref=e25]: パスワード
      - textbox "パスワード" [ref=e26]:
        - /placeholder: パスワードを入力
        - text: password
    - button "パスワードでログイン" [ref=e27] [cursor=pointer]
  - generic [ref=e32]: または
  - generic [ref=e33]:
    - button "Googleでログイン" [ref=e34] [cursor=pointer]:
      - img [ref=e35]
      - text: Googleでログイン
    - paragraph [ref=e37]:
      - text: アカウントが必要な方は
      - button "登録申請はこちら" [ref=e38] [cursor=pointer]
```