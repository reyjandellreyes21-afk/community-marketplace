import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { removeSaleMetaLines } from "../../lib/listingSaleMeta.js";

const mdComponents = (tone) => {
  const body = tone === "amber" ? "text-amber-950 dark:text-amber-50" : "text-neutral-800 dark:text-slate-200";
  const muted = tone === "amber" ? "text-amber-900/90 dark:text-amber-100/90" : "text-neutral-700 dark:text-slate-300";
  return {
    p: ({ children }) => (
      <p className={`mb-2 max-w-full break-words text-pretty text-sm leading-relaxed [overflow-wrap:anywhere] last:mb-0 ${body}`}>{children}</p>
    ),
    ul: ({ children }) => (
      <ul className={`mb-2 list-disc space-y-1 pl-5 text-sm leading-relaxed ${body}`}>{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className={`mb-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed ${body}`}>{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => (
      <strong className={`font-extrabold ${tone === "amber" ? "text-amber-950 dark:text-amber-50" : "text-neutral-900 dark:text-slate-100"}`}>
        {children}
      </strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    h1: ({ children }) => (
      <h4 className={`mb-2 text-base font-semibold leading-snug ${muted}`}>{children}</h4>
    ),
    h2: ({ children }) => (
      <h4 className={`mb-2 text-base font-semibold leading-snug ${muted}`}>{children}</h4>
    ),
    h3: ({ children }) => (
      <h4 className={`mb-1.5 text-sm font-semibold leading-snug ${muted}`}>{children}</h4>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:decoration-brand-primary dark:text-brand-accent dark:decoration-brand-accent/40"
      >
        {children}
      </a>
    ),
    code: ({ children }) => (
      <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] text-neutral-800 dark:bg-slate-800 dark:text-slate-100">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="mb-2 overflow-x-auto rounded-lg bg-neutral-100 p-2 text-xs dark:bg-slate-800">{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className={`mb-2 border-l-4 border-neutral-300 pl-3 text-sm italic dark:border-slate-600 ${body}`}
      >
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-neutral-200 dark:border-slate-700" />,
  };
};

/**
 * Renders listing description as GitHub-flavored Markdown (bold, lists, links).
 * Strips internal sale-discount meta lines before rendering.
 *
 * @param {"default" | "amber"} [props.tone] — amber matches “seller note” panels.
 */
export function ListingDescriptionMarkdown({ text, tone = "default", className = "" }) {
  const cleaned = removeSaleMetaLines(String(text ?? "")).trim();
  if (!cleaned) return null;

  return (
    <div className={`listing-description-md min-w-0 max-w-full break-words [overflow-wrap:anywhere] ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={mdComponents(tone)}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
