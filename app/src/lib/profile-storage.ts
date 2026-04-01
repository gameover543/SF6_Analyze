import type { UserProfile } from "@/types/profile";

const STORAGE_KEY = "sf6coach_profile";
const HISTORY_KEY = "sf6coach_chat_history";
/** セッションIDのLocalStorageキー（サーバー側履歴の識別に使用） */
const SESSION_ID_KEY = "sf6coach_session_id";

/** プロフィールを保存 */
export function saveProfile(profile: UserProfile): void {
  profile.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

/** プロフィールを読み込む（未設定ならnull） */
export function loadProfile(): UserProfile | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/** プロフィールを削除 */
export function clearProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** チャット履歴を保存 */
export function saveChatHistory(
  messages: Array<{ role: string; content: string }>
): void {
  // 直近50メッセージだけ保持（トークン節約）
  const trimmed = messages.slice(-50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

/** チャット履歴を読み込む */
export function loadChatHistory(): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** チャット履歴をクリア */
export function clearChatHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// ───────────────────────────────────────────────
// セッションID（サーバーサイド履歴の識別キー）
// ───────────────────────────────────────────────

/** セッションIDを取得（なければUUIDを生成して保存） */
export function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

/** セッションIDを取得（未設定ならnull） */
export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_ID_KEY);
}

/** セッションIDをクリア（プロフィールリセット時） */
export function clearSessionId(): void {
  localStorage.removeItem(SESSION_ID_KEY);
}
