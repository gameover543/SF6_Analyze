import Link from "next/link";

/**
 * フッターコンポーネント
 * 著作権ディスクレーマー + AI免責 + 利用規約/プライバシーポリシーへのリンク
 */
export default function Footer() {
  return (
    <footer className="border-t border-theme-border bg-theme-page text-theme-muted text-xs py-6 px-4">
      <div className="max-w-4xl mx-auto space-y-3 text-center">
        {/* 著作権ディスクレーマー + AI免責 */}
        <p>
          STREET FIGHTER、SF6は株式会社カプコン（CAPCOM）の登録商標です。
          本サイトはファンメイドであり、CAPCOMとは一切関係ありません。
        </p>
        <p>
          AI生成情報の正確性は保証されません。フレームデータはゲームアップデートにより変動する場合があります。
        </p>

        {/* リンク */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <Link href="/terms" className="hover:text-theme-text transition">
            利用規約
          </Link>
          <span className="text-theme-subtle">|</span>
          <Link href="/privacy" className="hover:text-theme-text transition">
            プライバシーポリシー
          </Link>
        </div>
      </div>
    </footer>
  );
}
