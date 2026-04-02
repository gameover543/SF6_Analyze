import Link from "next/link";

export const metadata = {
  title: "利用規約 - SF6 Coach",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">利用規約</h1>
      <p className="text-theme-muted text-sm mb-8">最終更新日: 2026年4月1日</p>

      <div className="space-y-8 text-sm leading-relaxed">
        {/* サービスの説明 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">サービスについて</h2>
          <p className="text-theme-muted">
            SF6 Coach（以下「本サービス」）は、ストリートファイター6のフレームデータ検索、
            対戦メモ帳、AI質問機能を提供する個人運営のWebサービスです。
            ユーザー登録不要で、どなたでもご利用いただけます。
          </p>
        </section>

        {/* 禁止事項 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">禁止事項</h2>
          <ul className="list-disc list-inside text-theme-muted space-y-1">
            <li>不正アクセスやサーバーに過度な負荷をかける行為</li>
            <li>API機能への大量リクエストや自動化ツールによる連続アクセス</li>
            <li>本サービスのデータを商用目的でスクレイピング・再配布する行為</li>
            <li>他のユーザーの利用を妨害する行為</li>
            <li>法令に違反する行為</li>
          </ul>
        </section>

        {/* AI生成情報の免責 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">AI生成情報について</h2>
          <p className="text-theme-muted">
            本サービスのAI回答はGoogle Gemini APIを利用して生成されます。
            AI生成情報は参考情報であり、正確性・完全性を保証するものではありません。
            AI回答に基づく判断はご自身の責任で行ってください。
          </p>
        </section>

        {/* フレームデータの免責 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">フレームデータについて</h2>
          <p className="text-theme-muted">
            フレームデータはゲームのアップデートにより変動する可能性があります。
            最新のデータと異なる場合がありますので、公式情報もあわせてご確認ください。
          </p>
        </section>

        {/* サービスの変更・終了 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">サービスの変更・終了</h2>
          <p className="text-theme-muted">
            本サービスは予告なく内容の変更、一時停止、または終了する場合があります。
            これにより生じた損害について、運営者は責任を負いません。
          </p>
        </section>

        {/* 知的財産 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">知的財産について</h2>
          <p className="text-theme-muted">
            STREET FIGHTER、ストリートファイター6、および関連するキャラクター名・画像等の
            知的財産権は株式会社カプコン（CAPCOM）に帰属します。
            本サービスはファンメイドであり、カプコンが公式に認定・後援するものではありません。
          </p>
        </section>

        {/* 準拠法 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">準拠法</h2>
          <p className="text-theme-muted">
            本規約は日本法に準拠し、日本法に従って解釈されるものとします。
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-theme-border">
        <Link href="/" className="text-sm text-theme-muted hover:text-theme-text transition">
          &larr; トップに戻る
        </Link>
      </div>
    </div>
  );
}
