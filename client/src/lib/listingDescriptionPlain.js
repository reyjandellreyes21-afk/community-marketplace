import { removeSaleMetaLines } from "./listingSaleMeta.js";

/**
 * Strip lightweight Markdown-style markers for card previews / truncated UI.
 * Existing listings without Markdown remain readable.
 */
export function markdownToPlainPreview(description, maxLen = 600) {
  let s = removeSaleMetaLines(String(description ?? ""));
  s = s
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/__([\s\S]*?)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[\s>*-]+\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (maxLen > 0 && s.length > maxLen) return `${s.slice(0, maxLen)}…`;
  return s;
}
