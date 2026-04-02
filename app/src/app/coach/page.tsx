import { redirect } from "next/navigation";

/** AIコーチ機能は現在非公開。メモページのAI質問機能にリダイレクト */
export default function CoachPage() {
  redirect("/memos");
}
