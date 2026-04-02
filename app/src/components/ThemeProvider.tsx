"use client";

import { useEffect, useState } from "react";

/** 利用可能なテーマ */
export type Theme = "dark" | "light" | "high-contrast";

const STORAGE_KEY = "sf6coach_theme";
const DEFAULT_THEME: Theme = "dark";

/** LocalStorageからテーマを読み込む（初回はOS設定を反映） */
function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "high-contrast") {
      return stored;
    }
    // 初回訪問時はOS設定に合わせる
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  } catch {
    // localStorage が使えない環境は無視
  }
  return DEFAULT_THEME;
}

/** テーマをhtmlのdata-theme属性とLocalStorageに保存 */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 無視
  }
}

/** テーマ切替ボタンのアイコンラベル */
const THEME_LABELS: Record<Theme, { icon: string; label: string; next: Theme }> = {
  dark: { icon: "☀", label: "ライトモード", next: "light" },
  light: { icon: "◑", label: "ハイコントラスト", next: "high-contrast" },
  "high-contrast": { icon: "●", label: "ダークモード", next: "dark" },
};

/**
 * テーマ管理プロバイダー。
 * html[data-theme] の切替とLocalStorage保存を担当。
 * ヘッダーに埋め込むテーマ切替ボタンを提供する。
 */
export default function ThemeProvider() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  // クライアントサイドでのみテーマを読み込む（SSRハイドレーション不一致を防ぐ）
  useEffect(() => {
    const saved = loadTheme();
    setTheme(saved);
    applyTheme(saved);
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const next = THEME_LABELS[theme].next;
    setTheme(next);
    applyTheme(next);
  };

  // SSR中はボタンを非表示（ちらつき防止）
  if (!mounted) return null;

  const { icon, label } = THEME_LABELS[theme];

  return (
    <button
      onClick={handleToggle}
      title={`${label}に切り替え`}
      className="shrink-0 text-theme-muted hover:text-theme-text transition text-sm px-2 py-1 rounded hover:bg-theme-raised"
      aria-label={label}
    >
      {icon}
    </button>
  );
}
