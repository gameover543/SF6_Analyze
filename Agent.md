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

### タスク#5: API通信のエラーハンドリング強化（2026-04-01）
`app/src/hooks/useChatMessages.ts` に `fetchWithRetry` と `getErrorMessage` 関数を追加し、リトライ・タイムアウト・ユーザーフレンドリーなエラーメッセージを実装した。

**変更内容:**
1. `fetchWithRetry(url, options, maxRetries=2, timeoutMs=45000)` — `AbortController` でタイムアウト管理。5xxエラー・ネットワークエラーを指数バックオフ（1秒→2秒）でリトライ
2. `getErrorMessage(err, status?)` — エラー種別ごとにメッセージを分岐:
   - `AbortError`: タイムアウトメッセージ（AIが混雑）
   - `TypeError`: ネットワーク接続確認を促すメッセージ
   - 5xx: サーバーエラーメッセージ
   - その他: 汎用メッセージ
3. `data.error` 表示を `エラー: xxx` から `⚠️ xxx` に変更
4. 4xx レスポンスはリトライせずエラーメッセージを即表示

## 累積した知見・注意点

- `_structured/by_matchup/` のファイル名は **収録したナレッジの視点キャラ側** が先頭になる
  - `ken_vs_jamie.json` は「ケン使いがジェイミーと対戦した際のナレッジ」を収録
  - ジェイミー使いが「ケン対策」を聞いた時は、`jamie_vs_ken.json`（存在しない場合が多い）でも`ken_vs_jamie.json`でも有用な情報が得られる
- `CHAR_JP` の反復順序はオブジェクト挿入順。`detectOpponent` はメインキャラをスキップしないと誤検出しやすい
- `_structured/_manifest.json` に `matchup_pairs` リストがある（利用可能なマッチアップファイルを事前確認できる）
- `ScraperConfig` の `__post_init__` で作成されるディレクトリ: `session_dir`, `output_dir`, `patches_dir`, `log_dir`
- `Message` 型は `app/src/hooks/useChatMessages.ts` から import すること（`@/hooks/useChatMessages`）
- `mode` 型は現在 `"counseling" | "coaching" | "matchup"` の3種類。新コンポーネントを作る場合は全3種を考慮すること

### タスク#6: テストスイートの整備（2026-04-01）
Vitest を導入し、Webアプリ側の単体テストを 25件追加した。

**追加ファイル:**
- `app/vitest.config.ts` — `@` エイリアスを `src/` に解決、Node.js 環境で実行
- `app/src/__tests__/lib/frame-data.test.ts` — `getCharacterFrameData`・`filterMovesByControlType`・`categorizeMoves`・`getFrameAdvantageColor` の純粋関数テスト（12件）
- `app/src/__tests__/lib/knowledge.test.ts` — `fs` モジュールをモックして `buildKnowledgeContext`・`buildMatchupKnowledgeContext` を検証（9件）
- `app/src/__tests__/api/characters.test.ts` — `next/server` を軽量モックし、GET /api/characters と GET /api/characters/[slug] を検証（4件）

**設計のポイント:**
- `knowledge.ts` は `fs` を直接使うため `vi.mock("fs")` でモック化。`existsSync`/`readFileSync` を `vi.fn()` に差し替えることでテスト内でファイルの有無・内容を制御
- `next/server` の `NextResponse.json()` はテスト用に `{ _data, _status }` を返す軽量モックに置き換え
- `npm test` スクリプトを `package.json` に追加（`vitest run`）

## 累積した知見・注意点

- `_structured/by_matchup/` のファイル名は **収録したナレッジの視点キャラ側** が先頭になる
  - `ken_vs_jamie.json` は「ケン使いがジェイミーと対戦した際のナレッジ」を収録
  - ジェイミー使いが「ケン対策」を聞いた時は、`jamie_vs_ken.json`（存在しない場合が多い）でも`ken_vs_jamie.json`でも有用な情報が得られる
- `CHAR_JP` の反復順序はオブジェクト挿入順。`detectOpponent` はメインキャラをスキップしないと誤検出しやすい
- `_structured/_manifest.json` に `matchup_pairs` リストがある（利用可能なマッチアップファイルを事前確認できる）
- `ScraperConfig` の `__post_init__` で作成されるディレクトリ: `session_dir`, `output_dir`, `patches_dir`, `log_dir`
- `Message` 型は `app/src/hooks/useChatMessages.ts` から import すること（`@/hooks/useChatMessages`）
- `mode` 型は現在 `"counseling" | "coaching" | "matchup"` の3種類。新コンポーネントを作る場合は全3種を考慮すること
- Vitest テストは `app/` 配下で `npm test` を実行。`vitest.config.ts` の `@` エイリアスは `src/` を指す

### タスク#7: チャット履歴のサーバーサイド永続化（2026-04-01）
ファイルベースのサーバーサイドストレージを追加し、LocalStorageとの二重保存方式を実装した。

**変更内容:**
1. `app/src/app/api/history/route.ts` — GET/POST エンドポイントを新規作成。`app/.data/history/{sessionId}.json` にファイル保存
2. `app/src/lib/profile-storage.ts` — `getOrCreateSessionId()` / `getSessionId()` / `clearSessionId()` を追加。UUID を LocalStorage の `sf6coach_session_id` キーで管理
3. `app/src/hooks/useSessionState.ts` — init を async 化。サーバーAPI → LocalStorage フォールバックの順で履歴を取得。`resetProfile()` で `clearSessionId()` も呼ぶ
4. `app/src/hooks/useChatMessages.ts` — コーチング/マッチアップ時のメッセージ保存で LocalStorage + サーバーへ非同期 POST（fire-and-forget）
5. `app/src/components/ChatInterface.tsx` — 「新しい会話」ボタンでサーバー側の履歴ファイルも削除（空配列をPOST）
6. `app/.gitignore` — `.data/` を追加

**設計のポイント:**
- セッションIDはLocalStorageに保管。将来の認証導入時はユーザーIDに差し替えるだけで対応可能
- LocalStorageは常にフォールバックとして維持するため、サーバーが落ちていても動作する
- `app/.data/history/` はローカル実行前提。Vercel展開時は Blob/KV に差し替えが必要（`route.ts` の `fs` 操作部分のみ変更）
- セッションIDのバリデーション（UUIDフォーマット正規表現）でパストラバーサル攻撃を防止

## 累積した知見・注意点

- `_structured/by_matchup/` のファイル名は **収録したナレッジの視点キャラ側** が先頭になる
  - `ken_vs_jamie.json` は「ケン使いがジェイミーと対戦した際のナレッジ」を収録
  - ジェイミー使いが「ケン対策」を聞いた時は、`jamie_vs_ken.json`（存在しない場合が多い）でも`ken_vs_jamie.json`でも有用な情報が得られる
- `CHAR_JP` の反復順序はオブジェクト挿入順。`detectOpponent` はメインキャラをスキップしないと誤検出しやすい
- `_structured/_manifest.json` に `matchup_pairs` リストがある（利用可能なマッチアップファイルを事前確認できる）
- `ScraperConfig` の `__post_init__` で作成されるディレクトリ: `session_dir`, `output_dir`, `patches_dir`, `log_dir`
- `Message` 型は `app/src/hooks/useChatMessages.ts` から import すること（`@/hooks/useChatMessages`）
- `mode` 型は現在 `"counseling" | "coaching" | "matchup"` の3種類。新コンポーネントを作る場合は全3種を考慮すること
- Vitest テストは `app/` 配下で `npm test` を実行。`vitest.config.ts` の `@` エイリアスは `src/` を指す
- セッションIDは `profile-storage.ts` の `getOrCreateSessionId()` で取得。コンポーネント側で直接生成しないこと

### タスク#10: ナレッジカバレッジダッシュボード（2026-04-01）
`app/src/app/admin/coverage/page.tsx` を新規作成し、`/admin/coverage` でカバレッジを可視化。

**実装内容:**
- `_coverage.json` から総件数・動画数・キャラ別カテゴリカウントを表示
- `_index.json` の `credibility_score` を10バケットに集計してヒストグラム表示
- キャラ別テーブル（合計降順）＋インラインバー
- Next.js Server Component として `fs.readFileSync` でサーバーサイド読み込み → 静的ページ（`○`）としてビルド
- `layout.tsx` のナビに「カバレッジ」リンクを追加（`text-xs text-gray-600` で控えめ表示）

**注意点:**
- `_coverage.json` のキャラslugは `honda`（`ehonda` ではない）。`CHAR_NAME` マップで対応
- `CATEGORY_COLORS` は Tailwind クラスではなくインライン `backgroundColor` を使用（動的クラスはパージされるため）

## 累積した知見・注意点（タスク#10追記）

- `_coverage.json` のキャラslugは `honda`（frame-dataは `ehonda`）。カバレッジ系ページでは `honda` を使うこと
- Tailwindで動的クラス（`bg-${color}-500` 等）はパージされる。色を動的に変えたい場合はインライン `style` で指定すること
- Next.js Server Component で `fs` を使うと静的ビルド時にデータを読み込み、`○`（Static）ページとして生成される

### タスク#11: パッチノート表示機能（2026-04-01）
`data/patches/` からパッチdiffを読み込み、キャラクターページに変更点を表示する機能を実装した。

**変更内容:**
1. `data/patches/_meta.json` — サンプルパッチエントリ（v1→v2）を追加。スクレイパー実行後は自動更新される
2. `data/patches/v1_to_v2.json` — サンプルパッチdiff（jamie/ryu/ken/chunli/guile の変更例）
3. `app/src/components/PatchNotes.tsx` — Server Component。`_meta.json` から最新パッチを特定し、キャラのdiffを表示
4. `app/src/app/frames/[slug]/page.tsx` — キャラクター名の下に `<PatchNotes slug={slug} />` を追加

**設計のポイント:**
- PatchNotes は Server Component として `fs.readFileSync` でサーバーサイド読み込み。静的ビルド（SSG）に対応
- パッチデータが存在しない、またはキャラに変更がない場合は `null` を返してUIに影響を与えない
- `impact_level` により表示色を分岐: 数値変更=黄色、プロパティ変更=青、追加=緑、削除=赤
- パッチファイルは `_meta.json` の `patches` 配列の末尾を「最新」として採用

**注意点:**
- `data/patches/` のdiffファイル名は `v{old}_to_v{new}.json` 形式（`save_diff()` が自動生成）
- スクレイパーが実際のパッチを処理すると `_meta.json` と差分ファイルが自動更新される

### タスク#8: フレームデータUIの強化（2026-04-01）
`app/src/components/FrameTable.tsx` にソート機能と技タイプフィルターボタンを追加した。

**追加内容:**
1. **技タイプフィルターボタン**: コントロール行の下にフィルターボタンを横並びで表示。「すべて」またはタイプ名をクリックすると、選択タイプのみ表示される。タイプフィルター有効時はグループ表示→フラット表示に切り替わる
2. **ソート機能**: テーブルヘッダー（技名・発生・持続・硬直・ガード・ヒット・ダメージ）をクリックすると昇順/降順ソート。数値パースに `parseInt(value, 10)` を使用、非数値は `Infinity` 扱いで末尾に集まる。ソート有効時はグループ表示→フラット表示に切り替わり「ソートをリセット」ボタンが現れる
3. **コンポーネント分割**: `MoveTable`（PC用テーブル本体）・`FlatTable`（フラット表示ラッパー）・`TypeSection`（アコーディオンセクション）・`SortableTh`（ソートヘッダー）に分割し可読性を向上

**設計のポイント:**
- グループ表示（アコーディオン）は `sortCol === null && typeFilter === null` のときのみ。フィルター/ソート有効時はフラットなテーブルに切り替わる
- `TypeSection` は独自の `expanded` state を持つ（各セクション独立に展開/折りたたみ可能）
- `SortableTh` はソート対象外のコマンド列と属性・キャンセル列には使わない

## 累積した知見・注意点（タスク#8追記）

- `FrameTable.tsx` はクライアントコンポーネント（`"use client"`）。Server Componentへの切り出しは不可
- フレーム値（block_frame等）は `"~5"`, `"0"`, `"+3"` など文字列。`parseInt` は `+` プレフィックスも正しく数値化する
- ソート時のグループ解除は UX上自然。フラット表示に切り替えてから「ソートをリセット」でグループ表示に戻る設計

### タスク#9: レスポンシブデザイン・モバイル対応（2026-04-01）
モバイル表示の最適化を実施。FrameTable.tsxのMoveCard（スマホ用カード表示）は実装済みだったため、周辺UIの改善に集中した。

**変更内容:**
1. `app/src/app/layout.tsx` — ヘッダーナビをスマホでもオーバーフローしないよう調整。「カバレッジ」リンクは`hidden sm:inline`でスマホ非表示。ナビ全体を`overflow-x-auto scrollbar-none`でスクロール可能に
2. `app/src/components/ChatInterface.tsx` — ツールバーのアクションボタン（通常モードへ・新しい会話・プロフィール変更）をスマホでは短縮テキストに（`sm:hidden`/`hidden sm:inline`で切替）。確認ダイアログを`flex-col sm:flex-row`で縦積みに対応
3. `app/src/components/chat/MessageList.tsx` — 空状態の`mt-20`を`mt-8 sm:mt-20`に変更してスマホで余白過多を解消
4. `app/src/components/FrameTable.tsx` — タイプフィルターボタンを`flex-wrap`→横スクロール（`overflow-x-auto scrollbar-none`）に変更。ソートリセットボタンを別行に分離してレイアウト崩れを防止。コントロール行のボタンに`shrink-0`を追加

**既存のモバイル対応（変更なし）:**
- `FrameTable.tsx` の `MoveCard` コンポーネント（`md:hidden`）は実装済み
- `ChatSidebar.tsx` のドロワー＋オーバーレイは実装済み
- `ChatInputArea.tsx` のキャラ表示は実装済み

## 次のタスクへの申し送り

- タスク#5以降: `useSessionState` の `mode` は3種類になった。新たなUIコンポーネントを追加する際は全モードに対応すること
- サイドバーの `max-height` は `style={{ maxHeight: "160px" }}` でインライン指定している（Tailwindの任意値は利用できない環境のため）
- `fetchWithRetry` はサーバーサイドでは使わないこと（`AbortController` はブラウザAPIだが Node.js でも動くため問題はないが、APIルートは直接 `llm.chat()` を呼ぶ設計のまま）
- テストを追加する際: `knowledge.ts` の内部ヘルパー（`detectOpponent` 等）はエクスポート非公開なので、`buildKnowledgeContext` 経由でブラックボックステストとして検証すること
- サーバーサイド履歴は `app/.data/history/{uuid}.json` に保存。`.data/` は `.gitignore` 済み
- Vercel 等のサーバーレス環境に展開する場合、`app/src/app/api/history/route.ts` の `fs` 操作を Vercel Blob や Upstash KV に差し替える必要がある
- `PatchNotes` コンポーネントは `app/src/components/PatchNotes.tsx`。パッチデータなし時は `null` 返却で安全（追加のキャラページはそのまま使える）
- `data/patches/_meta.json` の `patches` 配列末尾が最新パッチ。スクレイパー（`patch_diff.save_diff()`）が自動追記する
- モバイル対応パターン: テキストの短縮は `<span className="sm:hidden">短縮</span><span className="hidden sm:inline">フル</span>` で実装。横スクロール要素は `overflow-x-auto scrollbar-none` で。折り返し方向切替は `flex-col sm:flex-row`
- `FrameTable.tsx` のタイプフィルターは横スクロール方式（折り返しなし）。ボタンに `shrink-0` を忘れずつけること
