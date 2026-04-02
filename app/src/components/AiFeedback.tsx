"use client";

import { useState } from "react";
import { loadProfile } from "@/lib/profile-storage";

interface AiFeedbackProps {
  question: string;
  answer: string;
}

/** AI回答への👍/👎フィードバックボタン */
export default function AiFeedback({ question, answer }: AiFeedbackProps) {
  const [rated, setRated] = useState<"good" | "bad" | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  const handleRate = async (rating: "good" | "bad") => {
    setRated(rating);

    // 👎の場合はコメント入力を表示
    if (rating === "bad") {
      setShowComment(true);
      return;
    }

    // 👍はそのまま送信
    await sendFeedback(rating, "");
  };

  const handleSubmitComment = async () => {
    if (!rated) return;
    await sendFeedback(rated, comment);
    setShowComment(false);
    setSent(true);
  };

  const sendFeedback = async (rating: "good" | "bad", feedbackComment: string) => {
    try {
      const profile = loadProfile();
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          rating,
          comment: feedbackComment,
          profile: profile ? { mainCharacter: profile.mainCharacter, rank: profile.rank } : null,
        }),
      });
      setSent(true);
    } catch {
      // 送信失敗は静かに無視（ユーザー体験を妨げない）
    }
  };

  // 送信済み
  if (sent) {
    return (
      <span className="text-xs text-theme-subtle">
        {rated === "good" ? "👍" : "👎"} フィードバックありがとう！
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col">
      <div className="flex items-center gap-1">
        <span className="text-xs text-theme-subtle mr-1">この回答は？</span>
        <button
          onClick={() => handleRate("good")}
          className={`px-1.5 py-0.5 rounded text-xs transition ${
            rated === "good"
              ? "bg-blue-500/20 text-blue-400"
              : "text-theme-subtle hover:text-blue-400 hover:bg-blue-500/10"
          }`}
          aria-label="参考になった"
        >
          👍
        </button>
        <button
          onClick={() => handleRate("bad")}
          className={`px-1.5 py-0.5 rounded text-xs transition ${
            rated === "bad"
              ? "bg-red-500/20 text-red-400"
              : "text-theme-subtle hover:text-red-400 hover:bg-red-500/10"
          }`}
          aria-label="参考にならなかった"
        >
          👎
        </button>
      </div>

      {/* 👎時のコメント入力 */}
      {showComment && (
        <div className="mt-2 flex gap-1.5 animate-fade-in">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="何が良くなかった？（任意）"
            maxLength={200}
            className="flex-1 px-2 py-1 rounded bg-theme-raised border border-theme-border text-xs text-theme-text placeholder-theme-subtle focus:outline-none focus:border-red-500"
            onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
          />
          <button
            onClick={handleSubmitComment}
            className="px-2 py-1 rounded bg-theme-raised text-xs text-theme-muted hover:text-theme-text transition shrink-0"
          >
            送信
          </button>
        </div>
      )}
    </div>
  );
}
