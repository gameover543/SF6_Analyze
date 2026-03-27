# SF6 上達アプリ

## プロジェクト概要
SF6（ストリートファイター6）特化のAIコーチングWebアプリ。
フレームデータ検索 + LLMベースの会話型コーチング機能を提供する。

## アーキテクチャ
- `data/` — フレームデータ（JSON）。アプリの唯一のデータソース。gitで管理。
- `scraper/` — 公式サイトからフレームデータを取得する開発ツール。アプリ本体には依存しない。
- `app/` — Webアプリ本体（Phase 1で構築予定）

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
