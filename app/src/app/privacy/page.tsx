import Link from "next/link";

export const metadata = {
  title: "プライバシーポリシー - SF6 Coach",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">プライバシーポリシー</h1>
      <p className="text-theme-muted text-sm mb-8">最終更新日: 2026年4月1日</p>

      <div className="space-y-8 text-sm leading-relaxed">
        {/* 取得する情報 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">取得する情報</h2>
          <p className="text-theme-muted mb-2">
            本サービスでは、以下の情報を取得・保存します。
            氏名・メールアドレス等の個人を特定する情報は取得しません。
          </p>
          <ul className="list-disc list-inside text-theme-muted space-y-1">
            <li>対戦メモの内容</li>
            <li>AIへの質問履歴と回答</li>
            <li>プロフィール設定（メインキャラ、ランク帯など）</li>
            <li>セッションID（データの紐付けに使用）</li>
          </ul>
        </section>

        {/* データの保存場所 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">データの保存場所</h2>
          <ul className="list-disc list-inside text-theme-muted space-y-1">
            <li>
              <span className="font-medium text-theme-text">ブラウザ（localStorage）:</span>{" "}
              メモ、プロフィール設定などをお使いのブラウザ内に保存
            </li>
            <li>
              <span className="font-medium text-theme-text">サーバー（Vercel Blob）:</span>{" "}
              セッションIDに紐づくデータをサーバー上に保存
            </li>
          </ul>
        </section>

        {/* 利用目的 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">利用目的</h2>
          <ul className="list-disc list-inside text-theme-muted space-y-1">
            <li>サービスの提供・改善</li>
            <li>AIによる回答の生成</li>
          </ul>
        </section>

        {/* 外部送信先 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">外部サービスへの情報送信</h2>
          <p className="text-theme-muted mb-2">
            以下の外部サービスに情報を送信する場合があります。
          </p>
          <ul className="list-disc list-inside text-theme-muted space-y-1">
            <li>
              <span className="font-medium text-theme-text">Google Gemini API:</span>{" "}
              AI質問機能の利用時に、質問内容を送信します
            </li>
            <li>
              <span className="font-medium text-theme-text">Vercel:</span>{" "}
              ホスティング・データ保存のために利用します
            </li>
          </ul>
        </section>

        {/* Cookie */}
        <section>
          <h2 className="text-lg font-semibold mb-2">Cookieについて</h2>
          <p className="text-theme-muted">
            本サービスではCookieを使用しません。データの保存にはlocalStorageを使用しています。
          </p>
        </section>

        {/* データの削除 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">データの削除</h2>
          <p className="text-theme-muted">
            ブラウザに保存されたデータは、ブラウザの設定からlocalStorageをクリアすることで
            いつでも削除できます。サーバー上のデータの削除をご希望の場合はお問い合わせください。
          </p>
        </section>

        {/* ポリシーの変更 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">ポリシーの変更</h2>
          <p className="text-theme-muted">
            本ポリシーは予告なく変更される場合があります。
            重要な変更がある場合はサイト上でお知らせします。
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
