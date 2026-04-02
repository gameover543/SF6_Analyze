"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function FeedbackPage() {
  const [type, setType] = useState<"bug" | "feature" | "other">("other");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async () => {
    if (!message.trim()) return;

    // フィードバックをVercel Blobに保存（APIなしでlocalStorageに保存）
    try {
      const feedbacks = JSON.parse(localStorage.getItem("sf6coach_feedback") || "[]");
      feedbacks.push({
        type,
        message: message.trim(),
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
      localStorage.setItem("sf6coach_feedback", JSON.stringify(feedbacks));
      setSubmitted(true);
      showToast("フィードバックを送信しました！", "success");
    } catch {
      showToast("送信に失敗しました", "error");
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <p className="text-3xl mb-4">🙏</p>
        <h1 className="text-xl font-bold mb-2">ありがとうございます！</h1>
        <p className="text-theme-muted text-sm mb-8">
          フィードバックを受け付けました。今後の改善に活かします。
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-theme-accent-blue text-theme-page text-sm font-medium hover:opacity-90 transition"
        >
          トップへ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-theme-subtle mb-6">
        <Link href="/" className="hover:text-theme-text transition">
          トップ
        </Link>
        <span>/</span>
        <span className="text-theme-text">フィードバック</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">フィードバック</h1>
      <p className="text-theme-muted text-sm mb-8">
        バグ報告、機能リクエスト、改善要望をお聞かせください。
      </p>

      {/* タイプ選択 */}
      <div className="mb-4">
        <p className="text-xs text-theme-subtle mb-2">種類</p>
        <div className="flex gap-2">
          {([
            { value: "bug", label: "🐛 バグ報告" },
            { value: "feature", label: "💡 機能リクエスト" },
            { value: "other", label: "💬 その他" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
                type === opt.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "text-theme-muted border-theme-border hover:text-theme-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* メッセージ */}
      <div className="mb-6">
        <p className="text-xs text-theme-subtle mb-2">内容</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            type === "bug"
              ? "どのような問題が発生しましたか？再現手順があれば教えてください。"
              : type === "feature"
                ? "どんな機能があると嬉しいですか？"
                : "ご意見・ご感想をお聞かせください。"
          }
          rows={5}
          maxLength={1000}
          className="w-full px-3 py-2 rounded-lg bg-theme-panel border border-theme-border text-sm text-theme-text placeholder-theme-subtle focus:outline-none focus:border-blue-500 resize-none"
        />
        <p className="text-xs text-theme-subtle mt-1 text-right">{message.length}/1000</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!message.trim()}
        className="w-full py-3 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        送信
      </button>
    </div>
  );
}
