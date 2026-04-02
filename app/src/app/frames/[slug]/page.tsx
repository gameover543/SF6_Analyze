import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCharacterFrameData, CHARACTER_LIST } from "@/lib/frame-data";
import FrameTable from "@/components/FrameTable";
import PatchNotes from "@/components/PatchNotes";
import KnowledgeHighlight from "@/components/KnowledgeHighlight";
import MemoSummary from "@/components/memo/MemoSummary";
import ShareButton from "@/components/ShareButton";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** キャラ別の動的メタデータ */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const charInfo = CHARACTER_LIST.find((c) => c.slug === slug);
  if (!charInfo) return {};

  const title = `${charInfo.name}のフレームデータ`;
  const description = `${charInfo.name}の全技フレームデータ一覧。発生・硬直差・ダメージを検索。Classic/Modern両対応。`;

  return {
    title,
    description,
    openGraph: {
      title: `${charInfo.name}のフレームデータ - SF6 Coach`,
      description,
    },
  };
}

export default async function CharacterFramePage({ params }: PageProps) {
  const { slug } = await params;
  const charInfo = CHARACTER_LIST.find((c) => c.slug === slug);

  if (!charInfo) notFound();

  let data;
  try {
    data = getCharacterFrameData(slug);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-theme-subtle mb-6">
        <Link href="/frames" className="hover:text-white transition">
          フレームデータ
        </Link>
        <span>/</span>
        <span className="text-theme-text">{charInfo.name}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{charInfo.name}</h1>
        <ShareButton
          title={`${charInfo.name}のフレームデータ - SF6 Coach`}
          text={`${charInfo.name}の全技フレームデータ。発生・硬直差・ダメージを検索！`}
        />
      </div>

      {/* パッチノート: 最新パッチでの変更点を表示 */}
      <PatchNotes slug={slug} />

      {/* ナレッジハイライト: コーチング機能への導線 */}
      <KnowledgeHighlight slug={slug} charName={charInfo.name} />

      {/* 対戦メモ: このキャラとの直近メモを表示 */}
      <MemoSummary slug={slug} />

      <Suspense>
        <FrameTable moves={data.moves} characterName={charInfo.name} />
      </Suspense>
    </div>
  );
}

/** 全キャラの静的パスを生成 */
export function generateStaticParams() {
  return CHARACTER_LIST.map((char) => ({ slug: char.slug }));
}
