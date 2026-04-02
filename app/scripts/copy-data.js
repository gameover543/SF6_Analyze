/**
 * Vercelビルド前にdata/knowledge/とdata/patches/をapp/配下にコピーする
 *
 * ローカル開発では ../data/ への相対パスで動作するが、
 * Vercel上ではRoot Directory=appのためプロジェクトルートの
 * data/にアクセスできない。ビルド前にコピーして解決する。
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(ROOT, "..");

const copies = [
  {
    src: path.join(PROJECT_ROOT, "data", "knowledge"),
    dest: path.join(ROOT, "data", "knowledge"),
  },
  {
    src: path.join(PROJECT_ROOT, "data", "patches"),
    dest: path.join(ROOT, "data", "patches"),
  },
];

for (const { src, dest } of copies) {
  if (!fs.existsSync(src)) {
    console.log(`[copy-data] スキップ: ${src} が存在しません`);
    continue;
  }

  // 既に存在する場合はスキップ（ローカル開発時）
  if (fs.existsSync(dest)) {
    console.log(`[copy-data] スキップ: ${dest} は既に存在します`);
    continue;
  }

  // 親ディレクトリを作成
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // ディレクトリごとコピー（再帰）
  copyDirRecursive(src, dest);
  console.log(`[copy-data] コピー完了: ${src} → ${dest}`);
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
