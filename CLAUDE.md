# SF6 上達アプリ

## プロジェクト概要
SF6（ストリートファイター6）特化のAIコーチングWebアプリ。
フレームデータ検索 + LLMベースの会話型コーチング機能を提供する。

## アーキテクチャ
- `data/frame_data/` — フレームデータ（JSON）。gitで管理。
- `data/knowledge/` — プロ選手の動画から抽出した攻略ナレッジ（JSON）。gitで管理。
- `scraper/` — 公式サイトからフレームデータを取得する開発ツール。
- `scraper/video_knowledge/` — 動画ナレッジ抽出パイプライン。Gemini API + yt-dlp。
- `app/` — Webアプリ本体

## データ更新フロー（ハイブリッド方式）
1. SF6のパッチ・DLCリリース後、`scraper/` でデータ取得
2. 取得したJSONを `data/frame_data/` にコミット
3. アプリは `data/` のJSONを静的に参照

## 開発ルール
- コミットメッセージは日本語
- ブランチ名は英語のkebab-case
- コード内コメントは日本語
- セキュリティのベストプラクティスを常に適用

## キャラクターデータ
- キャラクターリスト: `scraper/constants.py` の `CHARACTER_LIST`
- フレームデータ: `data/frame_data/{slug}.json`
- 全キャラ統合データ: `data/all_characters_frame.json`

## コマンド
- スクレイパー実行: `cd scraper && python main.py --force`
- 特定キャラのみ: `cd scraper && python main.py --force --targets jamie ryu`
- ナレッジパイプライン: `cd scraper && python -m video_knowledge.main`
- ナレッジ（ジェイミーのみ）: `cd scraper && python -m video_knowledge.main --characters jamie`
- ナレッジ（特定URL）: `cd scraper && python -m video_knowledge.main --urls "URL"`
- ナレッジ（ドライラン）: `cd scraper && python -m video_knowledge.main --dry-run`
- カバレッジレポート: `cd scraper && python -m video_knowledge.main --coverage`
