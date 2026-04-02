import Link from "next/link";
import { CHARACTER_LIST } from "@/lib/frame-data";

export default function Home() {
  // 人気キャラをクイックアクセス用に表示（先頭8キャラ）
  const quickChars = CHARACTER_LIST.slice(0, 8);

  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* ヒーローセクション */}
      <section className="py-16 md:py-24 text-center">
        <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
          SF6 Coach
        </h1>
        <p className="text-lg md:text-xl text-theme-muted mb-8 max-w-2xl mx-auto">
          フレームデータ検索 × AI対戦メモで
          <br className="hidden sm:block" />
          対戦力を上げる
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/frames"
            className="px-6 py-3 rounded-lg bg-theme-accent-blue text-theme-page font-medium hover:opacity-90 transition"
          >
            フレームデータを見る
          </Link>
          <Link
            href="/memos"
            className="px-6 py-3 rounded-lg border border-theme-border font-medium hover:bg-theme-panel transition"
          >
            メモを書く
          </Link>
        </div>
      </section>

      {/* 機能紹介セクション */}
      <section className="pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon="🔍"
            title="フレームデータ検索"
            description="全29キャラの技データを瞬時に検索。発生・硬直差・ダメージまで完全網羅。Classic/Modern両対応。"
            href="/frames"
          />
          <FeatureCard
            icon="📝"
            title="AI付き対戦メモ"
            description="対戦中にサクッとメモ。キャラ別に整理して見返せる。AIに質問すればフレームデータに基づくアドバイスも。"
            href="/memos"
          />
          <FeatureCard
            icon="🎯"
            title="プロの知見"
            description="プロプレイヤーの攻略動画から抽出したナレッジをAIが活用。実戦的なアドバイスを提供。"
            href="/memos"
          />
        </div>
      </section>

      {/* 使い方セクション */}
      <section className="pb-16">
        <h2 className="text-xl font-bold mb-6 text-center">使い方</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StepCard step={1} title="キャラを選ぶ" description="メインキャラを設定すると、フレームデータやAIアドバイスが最適化されます。" />
          <StepCard step={2} title="フレームを調べる" description="対戦中に気になった技のフレームデータをサッと検索。有利不利が一目で分かります。" />
          <StepCard step={3} title="メモして上達" description="気づきをメモに残して振り返り。AIに質問すれば具体的な対策も教えてくれます。" />
        </div>
      </section>

      {/* キャラクイックアクセス */}
      <section className="pb-20">
        <h2 className="text-xl font-bold mb-6 text-center">フレームデータ</h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4">
          {quickChars.map((char) => (
            <Link
              key={char.slug}
              href={`/frames/${char.slug}`}
              className="flex items-center justify-center p-2 rounded-lg border border-theme-border hover:border-theme-accent-blue/50 hover:bg-theme-panel/50 transition text-xs sm:text-sm font-medium text-center"
            >
              {char.name}
            </Link>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/frames"
            className="text-sm text-theme-muted hover:text-theme-text transition"
          >
            全{CHARACTER_LIST.length}キャラを見る →
          </Link>
        </div>
      </section>
    </div>
  );
}

/** 機能紹介カード */
function FeatureCard({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block p-6 rounded-xl border border-theme-border hover:border-theme-accent-blue/50 hover:bg-theme-panel/50 transition"
    >
      <span className="text-2xl mb-3 block">{icon}</span>
      <h3 className="text-base font-semibold mb-2 group-hover:text-theme-accent-blue transition">
        {title}
      </h3>
      <p className="text-theme-muted text-sm leading-relaxed">{description}</p>
    </Link>
  );
}

/** ステップカード */
function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-theme-accent-blue text-theme-page text-sm font-bold mb-3">
        {step}
      </span>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-theme-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}
