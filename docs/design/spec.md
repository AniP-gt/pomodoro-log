## 1. アプリケーション概要
* **名称:** Pomodoro Log TUI/GUI (仮)
* **プラットフォーム:** macOS (Tauriを使用)
* **コア機能:** * ポモドーロタイマー（Work / Break）の実行。
    * メニューバー（System Tray）への常駐と残り時間表示。
    * 終了時に「経過時間」と「コメント」を指定のローカルファイル（Markdown/Text）へ追記。
    * ウィンドウを閉じてもメニューバーで動作を継続。

## 2. 技術スタック
* **Frontend:** React, TypeScript, Tailwind CSS
* **Backend:** Rust (Tauri v2推奨)
* **State Management:Zustand（タイマー状態の管理）モックはuseStateで管理しているので、zustandに切り替える
* **Log Persistence:** Rust `std::fs` (ファイル書き込み用)

## 3. 機能詳細

### A. メニューバー（System Tray）機能
* **アイコン表示:** メニューバーにタイマーアイコンと残り時間を表示（例: `[24:59]`）。
* **クイックメニュー:**
    * Show Window（ウィンドウを再表示）
    * Start / Pause / Reset
    * Quit（アプリを完全に終了）

### B. メインウィンドウ GUI
* **Timer Display:** 円形プログレスバーとカウントダウン。
* **Settings:**
    * Work/Breakの時間設定。
    * **ログ出力先パスの指定:** (例: `/Users/username/Documents/pomodoro_log.md`)
* **Log Entry Modal:**
    * タイマー終了時に自動または手動でポップアップ。
    * そのセッションで行った内容のメモ入力欄。

### C. ファイル書き込み仕様
セッション終了時、Rust側で以下のフォーマット（例）でファイルに追記します。
```markdown
## 2026-03-26 20:00
- Type: Work
- Duration: 25 min
- Comment: Reactのコンポーネント設計を完了させた。
```

## 4. UI/UX 設計


### ウィンドウ制御の挙動
1.  **Closeボタンの挙動:** ウィンドウの「×」ボタンを押してもプロセスは終了せず、メニューバーに常駐する。
2.  **再表示:** メニューバーの「Show Window」またはDockアイコンクリックでウィンドウを復元。

日付ベースの動的パス生成機能を組み込みました。

具体的には、設定されたベースパス（例: /Users/username/Documents/）に対し、現在の時刻から YYYY/MM/YYYY-MM-DD.md という階層構造を自動生成するロジックを React 側に追加しています。

これにより、日が変わるごとに自動で新しいディレクトリやファイルが作成される（Rust側でディレクトリ作成処理を実装することを前提）運用が可能になります。

更新された仕様のポイント
動的パス生成 (getDynamicPath):

baseDirectory（基点フォルダ）をユーザーが指定。

そこから自動的に /YYYY/MM/YYYY-MM-DD.md という構造を付加してフルパスを生成します。

設定画面で 「Preview Path」 として、実際にどのファイルに書き込まれるかをリアルタイムに確認できるようにしました。

階層構造のメリット:

月単位でフォルダが分かれるため、長期間利用してもログファイルが散らからず整理されます。

Rust側の処理で、親ディレクトリが存在しない場合に自動作成（fs::create_dir_all）するように設計すれば、ユーザーは最初に基点ディレクトリを決めるだけで済みます。

UIの改善:

タイマー画面の下部に「Next Log Entry」として、次に保存されるファイル名を表示するようにしました。

「現在何回目のワークか」を視覚的に強調し、ロング休憩への期待感を高めています。

## 5. バックエンド（Rust）実装のポイント

### システムトレイの設定
Tauriの `SystemTray` API（v2では `tray_icon`）を使用して、メニューバーにタイマーの状態を同期させます。
```rust
// Rust側でのイメージ（擬似コード）
fn update_tray_time(app_handle: AppHandle, time: String) {
    let tray_handle = app_handle.tray_handle();
    tray_handle.set_title(&time).unwrap();
}
```

### ファイルシステムアクセス
`tauri-plugin-fs` を使用して、ユーザーが設定画面で選んだ任意のパスへの書き込み権限を管理します。

---

## 6. 開発ロードマップ（ステップ）

1.  **Step 1:** `create-tauri-app` で React + TypeScript 環境を構築。
2.  **Step 2:** Rust側で `SystemTray` を設定し、メニューバーに "Hello" と表示させる。
3.  **Step 3:** React側で基本的なカウントダウンロジックを作成し、Rust側へ毎秒 `emit` してメニューバーのタイトルを更新する。
4.  **Step 4:** `tauri::api::dialog` を使い、ログ保存先のファイルパスを選択する機能を実装。
5.  **Step 5:** タイマー終了イベントをトリガーに、Rustのファイル書き込み関数を呼び出す。
6.  **Step 6:** macOSの `NSWindow` 制御を設定し、ウィンドウを閉じてもアプリが終了しないように調整。
