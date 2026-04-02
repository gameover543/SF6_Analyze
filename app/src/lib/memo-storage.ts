import type { Memo } from "@/types/memo";

const MEMOS_KEY = "sf6coach_memos";
const MAX_MEMOS = 500;

/** メモ一覧を保存 */
export function saveMemos(memos: Memo[]): void {
  const trimmed = memos.slice(0, MAX_MEMOS);
  localStorage.setItem(MEMOS_KEY, JSON.stringify(trimmed));
}

/** メモ一覧を読み込む */
export function loadMemos(): Memo[] {
  const raw = localStorage.getItem(MEMOS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Memo[];
  } catch {
    return [];
  }
}

/** メモ一覧をクリア */
export function clearMemos(): void {
  localStorage.removeItem(MEMOS_KEY);
}
