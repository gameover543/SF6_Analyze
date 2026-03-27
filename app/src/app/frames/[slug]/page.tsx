import Link from "next/link";
import { notFound } from "next/navigation";
import { getCharacterFrameData, CHARACTER_LIST } from "@/lib/frame-data";
import FrameTable from "@/components/FrameTable";

interface PageProps {
  params: Promise<{ slug: string }>;
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
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/frames" className="hover:text-white transition">
          フレームデータ
        </Link>
        <span>/</span>
        <span className="text-white">{charInfo.name}</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">{charInfo.name}</h1>

      <FrameTable moves={data.moves} characterName={charInfo.name} />
    </div>
  );
}

/** 全キャラの静的パスを生成 */
export function generateStaticParams() {
  return CHARACTER_LIST.map((char) => ({ slug: char.slug }));
}
