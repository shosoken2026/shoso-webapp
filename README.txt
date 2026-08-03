勝創建 管理アプリ 本格版 v1

ファイル:
- index.html
- styles.css
- app.js
- FIRESTORE_RULES.txt

Firebase側で必要な設定:
1. Authentication → ログイン方法 → メール/パスワードを有効化
2. Firestore Database → ルール → FIRESTORE_RULES.txtを貼り付けて公開
3. 最初のアカウントを新規登録
4. Firestoreの users コレクションで、そのアカウントの role を admin に変更
   employee = 従業員
   leader = 班長
   admin = 管理者

GitHub:
既存のindex.htmlだけでなく、この4ファイルを全部アップロードしてください。
