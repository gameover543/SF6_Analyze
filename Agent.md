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

### タスク#12: ストリーミング応答の実装（2026-04-01）
`llm.ts` に `streamChat` メソッド追加、`route.ts` でSSEストリーム返却、`useChatMessages.ts` でSSE受信＋リアルタイム表示を実装した。

**変更内容:**
1. `app/src/lib/llm.ts` — `streamChat(systemPrompt, messages): AsyncGenerator<string>` を追加。Gemini は `sendMessageStream()` でトークン逐次 yield。OpenAI は SSE 読み込みで同様に実装（将来用）。既存の `chat()` メソッドは削除し `streamChat` に一本化
2. `app/src/app/api/chat/route.ts` — `llm.chat()` を `llm.streamChat()` に変更し `ReadableStream` + `TextEncoder` で SSE 返却。フォーマット: `data: {"chunk":"..."}` / `data: [DONE]` / `data: {"error":"..."}`
3. `app/src/hooks/useChatMessages.ts` — `fetchWithRetry` を削除（ストリーミングとの相性不良）。`fetch` + `AbortController`（45秒タイムアウト）で接続し、`ReadableStreamReader` でSSEを逐次読み込み。空のassistantメッセージを事前追加してリアルタイム更新。カウンセリングモードは全文受信後にプロフィール抽出

**設計のポイント:**
- SSEバッファ処理: `buffer += decode(value)` → `split("\n")` → 末尾の不完全行を次回バッファに残す
- カウンセリングモードのプロフィール抽出は全文受信後に実施（ストリーム中にJSON境界をまたぐため）
- エラーが発生した場合も `data: {"error":"..."}` 形式で通知（接続前エラーは通常の `getErrorMessage` で処理）

### タスク#13: ナレッジ注入のトークン量最適化（2026-04-01）
`app/src/lib/knowledge.ts` にトークン推定・予算管理ロジックを追加し、ダイジェスト圧縮と動的エントリ数調整を実装した。

**変更内容:**
1. `estimateTokens(text)` — ASCII: 4文字=1トークン、日本語等: 1文字=1.5トークンで推定する軽量ヘルパー
2. `truncateDigest(digest, maxTokens)` — 行単位でダイジェストをトークン上限以内に切り詰め。上限: `DIGEST_MAX_TOKENS = 1200`
3. `calcMaxEntries(digestTokens, questionLength)` — ダイジェスト消費後の残余予算と質問の複雑さからエントリ上限を計算（2〜8件）
   - 短い質問（<30文字）: 3件、中程度（30-100文字）: 5件、長い/複雑（>100文字）: 7件
4. `buildKnowledgeContext()` — ダイジェストを `truncateDigest` で圧縮し、スライス件数をハードコードの5から `maxEntries` に変更
5. `buildMatchupKnowledgeContext()` — `latestQuestion` を関数先頭に移動。マッチアップエントリに上限追加（`calcMaxEntries(0, ...) + 3`、最大12件）

**トークン予算の設計値:**
- `DIGEST_MAX_TOKENS = 1200` （≈ 日本語800文字）
- `KNOWLEDGE_TOKEN_BUDGET = 3500`（ナレッジ全体）
- `AVG_ENTRY_TOKENS = 150`（エントリ1件の平均）
- ダイジェストの実際のサイズ: 7〜10KB（≈ 3500〜5000トークン）→ 約70%削減

**注意点:**
- ダイジェストは前半の重要セクション（キャラ特性・主要技・基本戦略）が優先的に残る
- テストは全25件通過。`truncateDigest` は短いモックテキストでは発動しないため既存テストに影響なし

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
- ナレッジのトークン予算: `DIGEST_MAX_TOKENS=1200`, `KNOWLEDGE_TOKEN_BUDGET=3500`, `AVG_ENTRY_TOKENS=150`。調整が必要な場合は `knowledge.ts` 先頭の定数を変更する

### タスク#14: ナレッジ増加に伴う_digests再生成（2026-04-01）
`scraper/video_knowledge/digest_generator.py` を全キャラ対象で実行し、ダイジェストを最新ナレッジに同期した。

**実施内容:**
- 全29キャラのダイジェストを再生成（約17分）
- ナレッジ件数: 多数のキャラで大幅増（ryu: 406→527, juri: 399→536, ken: 298→443, chunli: 247→412等）
- 生成されたダイジェスト: 各2246〜3650文字（平均約2900文字）
- `_digests/_manifest.json` も自動更新済み

**実行方法の確認:**
- `cd scraper && python -m video_knowledge.digest_generator` で実行（CLAUDE.mdの `--characters` 省略 = 全キャラ）
- Vertex AI (Gemini 2.5 Flash) を使用。各キャラ間に3秒のレートリミットスリープあり
- 実行ディレクトリは `scraper/` ではなく **プロジェクトルート** でも動作する（モジュールとして実行）

### タスク#15: ナレッジ検索の精度評価・改善（2026-04-01）
`app/src/lib/knowledge.ts` のスコアリング強化と類義語辞書拡充を実施し、精度評価テストセットを追加した。

**変更内容:**
1. `scoreEntry()` 改善:
   - シグネチャに `detectedCategory?: string | null` を追加
   - カテゴリ直接一致ボーナス +4 を追加（質問意図とカテゴリが一致するエントリを優先）
   - content キーワード検索範囲を 100→200文字、10→15ワードに拡張
2. `SYNONYMS` 拡充（8項目追加）:
   - 既存: 起き攻め・立ち回り・コンボ・対策・防御・対空
   - 新規: 崩し/投げ/中段/OD(オーバードライブ)/SA(スーパーアーツ)/ドライブゲージ/コーナー等
3. `buildKnowledgeContext`: `detectedCategory` を事前計算しフォールバックスコアリングにも渡す
4. 精度評価テストセット (`knowledge.test.ts` に `describe("ナレッジ検索精度評価テストセット")` を追加):
   - 6件のテスト（起き攻め再現率・適合率、コンボカテゴリボーナス、対策マッチアップ、類義語×2、防御）
   - テスト総数: 25 → 32件

**設計のポイント:**
- カテゴリボーナスが効くのは「トピックにキーワードが少ないがカテゴリは正しいエントリ」。フォールバック層での精度改善が主目的
- `detectCategory` は `buildKnowledgeContext` 内で事前に1回だけ呼ぶ設計に統一

### タスク#16: コーチ応答品質のA/Bテスト基盤（2026-04-01）
`scraper/ab_benchmark.py` を新規作成。5つのベンチマーク質問 × 5バリアントで応答を生成し、LLM-as-a-Judgeで品質を自動評価する仕組みを構築した。

**実装内容:**
1. `BENCHMARK_CASES` — 5件の評価質問セット（ナレッジ活用テスト・フレーム引用テスト・システム知識テスト・対戦知識テスト・モダン操作テスト）
2. `VariantConfig` クラス — プロンプト構築の設定差分を表す（use_knowledge/use_digest/max_entries/max_frame_moves/prompt_style）
3. `VARIANTS` — 5バリアント定義:
   - `baseline`: 現行設定（ダイジェスト+エントリ8件+フレーム15技）
   - `no_knowledge`: ナレッジなし（フレームデータのみ）
   - `no_digest`: ダイジェストなし（エントリのみ）
   - `more_entries`: ナレッジエントリ増加（最大15件）
   - `strict_prompt`: 厳格プロンプト（フレーム引用を義務付け）
4. `build_variant_prompt()` — バリアント設定に基づいてシステムプロンプトを構築
5. `evaluate_response()` — Gemini 2.5 Flashをジャッジに使い、正確性・実用性・フレーム引用の3軸でスコアリング（各1-5点）
6. `print_summary_table()` — バリアント別平均スコアの比較テーブルをコンソール出力
7. CLIオプション: `--variants`, `--cases`, `--skip-eval`, `--output`

**実行方法:**
```
cd scraper && python ab_benchmark.py                         # 全バリアント×全ケース
cd scraper && python ab_benchmark.py --variants baseline,no_knowledge
cd scraper && python ab_benchmark.py --cases bm_01 bm_02
cd scraper && python ab_benchmark.py --skip-eval            # 応答生成のみ（評価なし）
```
結果は `scraper/logs/ab_benchmark_results.json` に保存される。

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
- `llm.ts` の `chat()` メソッドは削除済み。`streamChat()` のみ使用すること
- SSEバッファ処理の定石: `buffer += decode(value, { stream: true })` → `split("\n")` → `buffer = lines.pop() || ""`（末尾の不完全行をバッファに残す）
- カウンセリングモードのプロフィールJSON抽出は全文受信後に実施。ストリーミング中間でJSONブロックが分割される可能性があるため
- ナレッジトークン予算の定数は `knowledge.ts` の `DIGEST_MAX_TOKENS=1200`, `KNOWLEDGE_TOKEN_BUDGET=3500`, `AVG_ENTRY_TOKENS=150`。LLMが文脈不足に感じた場合は `KNOWLEDGE_TOKEN_BUDGET` を増やすことを検討
- `_digests/` の再生成はプロジェクトルートから `python -m video_knowledge.digest_generator` で実行。約17分かかる（29キャラ × API呼び出し + 3秒スリープ）。ナレッジ大量追加後は定期的に再生成すること
- `_digests/_manifest.json` の `chars` フィールドはダイジェスト生成時のエントリ数。現在のエントリ数と比較して差が大きければ再生成の目安になる
- `buildMatchupKnowledgeContext` の `latestQuestion` は関数先頭で宣言済み（マッチアップ上限計算と補完ナレッジ計算の両方で使用）
- `scoreEntry()` の第3引数 `detectedCategory` はオプショナル。省略すると旧動作と同じ（カテゴリボーナスなし）
- 精度評価テストはモックでカテゴリインデックスやフォールバックJSONを制御する方式。`endsWith("jamie.json") && !includes("_structured") && !includes("_digests")` でフォールバックファイルを特定すること
- `ab_benchmark.py` のバリアント追加方法: `VARIANTS` 辞書に `VariantConfig` を追加するだけ。既存テスト結果とJSONで比較できる
- ベンチマーク結果は `scraper/logs/ab_benchmark_results.json`（gitignore対象外なので注意）。大量実行時は `--output` で別ファイルに保存すること
- `--skip-eval` オプションで評価なし（応答生成のみ）に切り替え可能。APIコスト節約や応答プレビュー確認に使う

### タスク#17: 会話のMarkdownレンダリング強化（2026-04-01）
`MessageList.tsx` に `react-markdown` + `remark-gfm` を導入し、AIの応答をMarkdown→HTMLとしてリッチ表示するよう改修した。

**変更内容:**
- `app/package.json` — `react-markdown`・`remark-gfm` を dependencies に追加
- `app/src/components/chat/MessageList.tsx` — assistantメッセージのみ `<ReactMarkdown>` でレンダリング（ユーザーメッセージは従来通りプレーンテキスト）
- カスタム `components` マップで全要素にTailwindクラスを適用:
  - `h1`/`h2`/`h3`: 見出しスタイル
  - `strong`/`em`: 太字・斜体
  - `ul`/`ol`/`li`: リスト
  - `code`/`pre`: インラインコード（`bg-gray-900 text-green-400`）・コードブロック
  - `table`/`thead`/`tbody`/`tr`/`th`/`td`: テーブル（`overflow-x-auto` でスクロール対応）
  - `blockquote`/`hr`: 引用・水平線

**設計のポイント:**
- ユーザーメッセージは `whitespace-pre-wrap` のプレーンテキストのまま（Markdownは解釈しない）
- assistantメッセージのみ `<ReactMarkdown>` でレンダリング。条件分岐でロールを判定
- テーブルは `overflow-x-auto` ラッパーでモバイル対応済み
- コードブロック判定: `className?.includes("language-")` でインラインコードとブロックコードを区別

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
- ナレッジのトークン予算: `DIGEST_MAX_TOKENS=1200`, `KNOWLEDGE_TOKEN_BUDGET=3500`, `AVG_ENTRY_TOKENS=150`
- `llm.ts` の `chat()` メソッドは削除済み。`streamChat()` のみ使用すること
- Markdownレンダリングは `react-markdown` + `remark-gfm`（テーブル対応）。assistantメッセージのみ適用。ユーザーメッセージはプレーンテキスト

### タスク#18: 対戦相手のフレームデータもコーチに参照させる（通常モード）（2026-04-01）
`knowledge.ts` の `detectOpponent` を export し、`route.ts` の通常コーチングモードで対戦相手を自動検出してフレームデータを追加注入するよう改修した。

**変更内容:**
1. `app/src/lib/knowledge.ts` — `detectOpponent` 関数を `export` に変更（既存のシグネチャ・動作は変更なし）
2. `app/src/app/api/chat/route.ts` — 通常コーチングモードの `else` ブランチで:
   - `latestQuestion` をループ外に移動（フレームデータビルドと対戦相手検出の両方で使用）
   - `detectOpponent(latestQuestion, mainSlug)` で対戦相手を検出
   - 検出された場合、`slugs.add(detectedOpponent)` でフレームデータ対象に追加

**動作:**
- 「ケンの昇竜って何フレ？」→ ケンが検出され、ケンのフレームデータがコンテキストに追加される
- メインキャラ自身は除外されるため誤検出なし（既存の `detectOpponent` の設計を継承）
- `slugs.slice(0, 3)` の上限あり（メインキャラ + 対戦相手で計2件が通常ケース）

## 累積した知見・注意点

- `detectOpponent` は `knowledge.ts` から `export` されており、`route.ts` から直接インポート可能
- テストで `detectOpponent` を単体テストしたい場合は `@/lib/knowledge` から import できる（タスク#18以降）

### タスク#19: charNames定数の一元管理（2026-04-01）
`app/src/lib/characters.ts` を新規作成し、キャラslug→日本語名マップを一元化した。

**変更内容:**
1. `app/src/lib/characters.ts` — `CHAR_JP` を `export` で定義。`ehonda` と `honda` の両方を含む（フレームデータは ehonda、ナレッジデータは honda を使うため）
2. `app/src/lib/knowledge.ts` — ローカル定義の `CHAR_JP` を削除し、`characters.ts` から import
3. `app/src/lib/prompts.ts` — ローカルの `charNames` 定義を削除し、`CHAR_JP` を import
4. `app/src/app/api/chat/route.ts` — ローカルの `charNames` 定義を削除し、`CHAR_JP` を import
5. `app/src/app/admin/coverage/page.tsx` — ローカルの `CHAR_NAME` 定義を削除し、`CHAR_JP` を import

**統合後のキャラ名（代表的な変更点）:**
- `aki`: "アキ" / "A.K.I." → **"A.K.I."** に統一（SF6の正式名称）
- `cviper`: "バイパー" / "C.ヴァイパー" → **"C.ヴァイパー"** に統一
- `ehonda`/`honda`: 両slugとも **"本田"** に解決（二重登録で対応）

## 累積した知見・注意点

- `CHAR_JP` は `app/src/lib/characters.ts` に一元管理。新キャラ追加時はここを更新するだけでよい
- `ehonda`（フレームデータslug）と `honda`（ナレッジデータslug）の両方が `CHAR_JP` に登録されている。どちらのslugでも日本語名を解決できる

## 次のタスクへの申し送り

- タスク#5以降: `useSessionState` の `mode` は3種類になった。新たなUIコンポーネントを追加する際は全モードに対応すること
- サイドバーの `max-height` は `style={{ maxHeight: "160px" }}` でインライン指定している（Tailwindの任意値は利用できない環境のため）
- テストを追加する際: `detectOpponent` はタスク#18以降 export 済みなので直接テスト可能。`buildKnowledgeContext` 経由のブラックボックステストも引き続き有効
- サーバーサイド履歴は `app/.data/history/{uuid}.json` に保存。`.data/` は `.gitignore` 済み
- Vercel 等のサーバーレス環境に展開する場合、`app/src/app/api/history/route.ts` の `fs` 操作を Vercel Blob や Upstash KV に差し替える必要がある
- `PatchNotes` コンポーネントは `app/src/components/PatchNotes.tsx`。パッチデータなし時は `null` 返却で安全
- `data/patches/_meta.json` の `patches` 配列末尾が最新パッチ。スクレイパー（`patch_diff.save_diff()`）が自動追記する
- モバイル対応パターン: テキストの短縮は `<span className="sm:hidden">短縮</span><span className="hidden sm:inline">フル</span>` で実装
- `FrameTable.tsx` のタイプフィルターは横スクロール方式（折り返しなし）。ボタンに `shrink-0` を忘れずつけること
- SSEバッファ処理の定石: `buffer += decode(value, { stream: true })` → `split("\n")` → `buffer = lines.pop() || ""`（末尾の不完全行をバッファに残す）
- カウンセリングモードのプロフィールJSON抽出は全文受信後に実施。ストリーミング中間でJSONブロックが分割される可能性があるため
- ナレッジトークン予算の定数は `knowledge.ts` の `DIGEST_MAX_TOKENS=1200`, `KNOWLEDGE_TOKEN_BUDGET=3500`, `AVG_ENTRY_TOKENS=150`
- `_digests/` の再生成はプロジェクトルートから `python -m video_knowledge.digest_generator` で実行。約17分かかる（29キャラ × API呼び出し + 3秒スリープ）
- `scoreEntry()` の第3引数 `detectedCategory` はオプショナル。省略すると旧動作と同じ（カテゴリボーナスなし）
- `ab_benchmark.py` のバリアント追加方法: `VARIANTS` 辞書に `VariantConfig` を追加するだけ
- ベンチマーク結果は `scraper/logs/ab_benchmark_results.json`。大量実行時は `--output` で別ファイルに保存すること
- `react-markdown` の `components` プロップで各要素のレンダリングをカスタマイズ可能。Tailwindクラスを直接適用する方式（グローバルCSS不要）
- インラインコードとコードブロックの区別: `code` コンポーネントの `className` が `language-*` を含むかどうかで判定すること
- キャラslug→日本語名は `@/lib/characters` の `CHAR_JP` を import すること。ローカル定義を追加しないこと（タスク#19以降）
- 新キャラ追加時は `app/src/lib/characters.ts` の `CHAR_JP` のみ更新すれば全箇所に反映される
