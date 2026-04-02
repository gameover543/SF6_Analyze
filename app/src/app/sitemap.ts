import type { MetadataRoute } from "next";
import { CHARACTER_LIST } from "@/lib/frame-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sf6-coach.vercel.app";

/** サイトマップ自動生成 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/frames`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/memos`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  // キャラ別フレームデータページ
  const charPages: MetadataRoute.Sitemap = CHARACTER_LIST.map((char) => ({
    url: `${SITE_URL}/frames/${char.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...charPages];
}
