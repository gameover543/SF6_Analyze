# Agent自己改善ログ

## 概要
このファイルはタスク自動実行ループで、セッション間の知見を共有するためのものです。
各タスク完了後にエージェントが学んだこと・注意点・改善提案を記録し、
次のセッションが読み込んで活用します。

## プロジェクト構造メモ
- `app/` — Next.js Webアプリ（src/app, src/components, src/lib, src/types）
- `data/frame_data/` — キャラ別フレームデータJSON（30キャラ）
- `data/knowledge/` — 動画抽出ナレッジ（448ファイル、_structured/, _digests/）
- `scraper/` — Pythonスクレイパー＆ナレッジパイプライン
- `scripts/` — ユーティリティスクリプト

## 完了タスクの記録

### タスク#1: 構造化ナレッジのコーチング統合（2026-04-01）
`app/src/lib/knowledge.ts` の2つのバグを修正し、_structured/ インデックスが正しくコーチングに統合されるようにした。

**修正内容:**
1. `detectOpponent` に `mainSlug` 引数を追加し、メインキャラ自身をスキップするよう修正。
   - 例: 「ジェイミーでケンに勝てない」→ 以前は"jamie"が最初にヒットして対戦相手が見つからなかった
   - 修正後: "jamie"をスキップして"ken"を正しく検出
2. `loadMatchupIndex` に逆引きロジックを追加。
   - `jamie_vs_ken.json` が存在しない場合、`ken_vs_jamie.json` を探すよう改修
   - マッチアップデータはどちら向きのファイルでも活用できるようになった

**注意:** `e046d3f` コミット時点で 3層構造（ダイジェスト・インデックス検索・キーワードフォールバック）は実装済みだったが、上記2バグによりインデックス検索が機能していなかった。

## 累積した知見・注意点

- `_structured/by_matchup/` のファイル名は **収録したナレッジの視点キャラ側** が先頭になる
  - `ken_vs_jamie.json` は「ケン使いがジェイミーと対戦した際のナレッジ」を収録
  - ジェイミー使いが「ケン対策」を聞いた時は、`jamie_vs_ken.json`（存在しない場合が多い）でも`ken_vs_jamie.json`でも有用な情報が得られる
- `CHAR_JP` の反復順序はオブジェクト挿入順。`detectOpponent` はメインキャラをスキップしないと誤検出しやすい
- `_structured/_manifest.json` に `matchup_pairs` リストがある（利用可能なマッチアップファイルを事前確認できる）

### タスク#2: パッチ追跡インフラの有効化（2026-04-01）
`data/patches/` ディレクトリと初期 `_meta.json` を作成し、`ScraperConfig` に `patches_dir` フィールドを追加した。

**変更内容:**
1. `scraper/config.py` に `patches_dir: Path = data_dir / "patches"` を追加し、`__post_init__` で自動作成するよう設定
2. `scraper/main.py` のハードコード `config.data_dir / "patches"` を `config.patches_dir` に統一
3. `data/patches/_meta.json` を初期状態（空のパッチリスト）で作成

**フロー確認:** `scraper/main.py --force` → `patch_diff.compute_diff()` → `patch_diff.save_diff()` → `revalidator.revalidate_knowledge()` の全連携が有効化された。

## 累積した知見・注意点

- `_structured/by_matchup/` のファイル名は **収録したナレッジの視点キャラ側** が先頭になる
  - `ken_vs_jamie.json` は「ケン使いがジェイミーと対戦した際のナレッジ」を収録
  - ジェイミー使いが「ケン対策」を聞いた時は、`jamie_vs_ken.json`（存在しない場合が多い）でも`ken_vs_jamie.json`でも有用な情報が得られる
- `CHAR_JP` の反復順序はオブジェクト挿入順。`detectOpponent` はメインキャラをスキップしないと誤検出しやすい
- `_structured/_manifest.json` に `matchup_pairs` リストがある（利用可能なマッチアップファイルを事前確認できる）
- `ScraperConfig` の `__post_init__` で作成されるディレクトリ: `session_dir`, `output_dir`, `patches_dir`, `log_dir`

### タスク#3: ChatInterfaceコンポーネントの分割リファクタリング（2026-04-01）
535行の `ChatInterface.tsx` を2カスタムフック＋3サブコンポーネントに分割した。

**分割結果:**
- `app/src/hooks/useSessionState.ts` — プロフィール・モード・キャラ選択・初期化を管理
- `app/src/hooks/useChatMessages.ts` — メッセージ送受信・isLoading・履歴保存を管理。`Message` 型もここで定義・export
- `app/src/components/chat/ChatSidebar.tsx` — サイドバー（プロフィールカード＋キャラ選択）
- `app/src/components/chat/MessageList.tsx` — メッセージ一覧・空状態・ローディング表示。自動スクロールも担当
- `app/src/components/chat/ChatInputArea.tsx` — テキスト入力＋送信ボタン

**注意点:**
- `useSessionState` と `useChatMessages` は循環しないよう設計。プロフィール抽出コールバック `onProfileExtracted` で疎結合に連携
- 初期履歴の復元は `useEffect([initialized])` で一度だけ行う（ChatInterface本体の責務）
- `resetProfile()` はLocalStorageのクリアのみ担当。メッセージクリアは `clearMessages()` を呼ぶ側（ChatInterface）が行う

## 累積した知見・注意点

- `_structured/by_matchup/` のファイル名は **収録したナレッジの視点キャラ側** が先頭になる
  - `ken_vs_jamie.json` は「ケン使いがジェイミーと対戦した際のナレッジ」を収録
  - ジェイミー使いが「ケン対策」を聞いた時は、`jamie_vs_ken.json`（存在しない場合が多い）でも`ken_vs_jamie.json`でも有用な情報が得られる
- `CHAR_JP` の反復順序はオブジェクト挿入順。`detectOpponent` はメインキャラをスキップしないと誤検出しやすい
- `_structured/_manifest.json` に `matchup_pairs` リストがある（利用可能なマッチアップファイルを事前確認できる）
- `ScraperConfig` の `__post_init__` で作成されるディレクトリ: `session_dir`, `output_dir`, `patches_dir`, `log_dir`
- `Message` 型は `app/src/hooks/useChatMessages.ts` から import すること（`@/hooks/useChatMessages`）

### タスク#4: マッチアップ特化コーチングモードの追加（2026-04-01）
サイドバーで対戦相手を選択すると "matchup" モードへ移行し、by_matchupデータを全件優先ロードするコーチングを提供する。

**変更ファイル:**
- `app/src/lib/knowledge.ts` — `buildMatchupKnowledgeContext(mainSlug, opponentSlug, recentMessages)` を追加。マッチアップデータ全件 → カテゴリ補完 → キーワードフォールバックの順で構成
- `app/src/lib/prompts.ts` — `buildCoachSystemPrompt` に `matchupFocus?: { mainName, opponentName }` を追加。渡すとプロンプト冒頭にマッチアップ分析モードのセクションが挿入される
- `app/src/app/api/chat/route.ts` — `mode === "matchup"` ブランチを追加。`opponentChar` を受け取りメインキャラ+対戦相手の両フレームデータを注入
- `app/src/hooks/useSessionState.ts` — `mode` 型を `"counseling" | "coaching" | "matchup"` に拡張。`opponentChar` state・`enterMatchupMode()`・`exitMatchupMode()` を追加
- `app/src/hooks/useChatMessages.ts` — `mode` 型と `opponentChar?` パラメータを追加。API bodyに `opponentChar` を含める
- `app/src/components/chat/ChatSidebar.tsx` — コーチングモード時に「マッチアップ分析」セクションを追加（キャラ一覧から対戦相手を選択）。マッチアップモード時は対戦カード表示と「通常コーチングに戻る」ボタンを表示
- `app/src/components/ChatInterface.tsx` — ツールバーにマッチアップモードバッジ（紫色）と「通常モードへ」ボタンを追加。`handleEnterMatchup`/`handleExitMatchup` で会話クリアも実施
- `app/src/components/chat/MessageList.tsx` / `ChatInputArea.tsx` — mode型拡張・マッチアップモード用空状態UI・プレースホルダー対応

**設計のポイント:**
- マッチアップモードへの移行時に `clearMessages()` を呼び、コンテキストを新鮮な状態で開始
- 既存の counseling/coaching フローは一切変更なし（後方互換）

## 累積した知見・注意点

- `_structured/by_matchup/` のファイル名は **収録したナレッジの視点キャラ側** が先頭になる
  - `ken_vs_jamie.json` は「ケン使いがジェイミーと対戦した際のナレッジ」を収録
  - ジェイミー使いが「ケン対策」を聞いた時は、`jamie_vs_ken.json`（存在しない場合が多い）でも`ken_vs_jamie.json`でも有用な情報が得られる
- `CHAR_JP` の反復順序はオブジェクト挿入順。`detectOpponent` はメインキャラをスキップしないと誤検出しやすい
- `_structured/_manifest.json` に `matchup_pairs` リストがある（利用可能なマッチアップファイルを事前確認できる）
- `ScraperConfig` の `__post_init__` で作成されるディレクトリ: `session_dir`, `output_dir`, `patches_dir`, `log_dir`
- `Message` 型は `app/src/hooks/useChatMessages.ts` から import すること（`@/hooks/useChatMessages`）
- `mode` 型は現在 `"counseling" | "coaching" | "matchup"` の3種類。新コンポーネントを作る場合は全3種を考慮すること

## 次のタスクへの申し送り

- タスク#5以降: `useSessionState` の `mode` は3種類になった。新たなUIコンポーネントを追加する際は全モードに対応すること
- サイドバーの `max-height` は `style={{ maxHeight: "160px" }}` でインライン指定している（Tailwindの任意値は利用できない環境のため）
