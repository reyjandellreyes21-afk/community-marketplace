import { useCallback, useState } from "react";
import { apiRequest } from "../lib/appApi.js";
import { UI_KIT } from "../lib/appUiKit.js";
import { SecondaryScreenHeader } from "./SecondaryScreenHeader.jsx";

const CATEGORIES = [
  { value: "experience", label: "General experience" },
  { value: "improvement", label: "Something to improve" },
  { value: "concern", label: "A concern" },
  { value: "other", label: "Other" },
];

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600 dark:text-slate-400";
const selectClass =
  "input-base w-full rounded-md border-neutral-300/90 text-sm text-neutral-900 focus-visible:border-neutral-800 focus-visible:ring-neutral-800/25 dark:border-slate-600 dark:text-slate-100 dark:focus-visible:border-slate-300 dark:focus-visible:ring-slate-300/25";
const textareaClass =
  "textarea-base w-full resize-y rounded-md border-neutral-300/90 text-sm leading-relaxed text-neutral-900 focus-visible:border-neutral-800 focus-visible:ring-neutral-800/25 dark:border-slate-600 dark:text-slate-100 dark:focus-visible:border-slate-300 dark:focus-visible:ring-slate-300/25";

/**
 * Logged-in screen: submit app experience feedback (separate from seller order reviews).
 */
export function SendFeedbackView({ token, onSuccess, onBack }) {
  const [category, setCategory] = useState("experience");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const clientPlatform =
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 767px)").matches
      ? "mobile"
      : "desktop";

  const submit = useCallback(async () => {
    if (!token) return;
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please describe your feedback.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiRequest("/app-feedback", {
        method: "POST",
        token,
        body: {
          category,
          message: trimmed,
          clientPlatform,
        },
      });
      setDone(true);
      onSuccess?.();
    } catch (e) {
      setError(e?.message || "Could not send feedback. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [token, category, message, clientPlatform, onSuccess]);

  const shellClass = `${UI_KIT.viewSection} mx-auto w-full max-w-2xl pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch] md:mx-0 md:w-full md:max-w-none md:min-h-[calc(100dvh-7.75rem-env(safe-area-inset-bottom,0px))] md:flex md:flex-col`;

  const bodyClass =
    "space-y-5 max-[360px]:space-y-4 max-[390px]:space-y-4 max-[430px]:space-y-4 md:flex-1 md:space-y-6";

  if (done) {
    return (
      <section className={shellClass}>
        <div className="hidden md:block">
          <SecondaryScreenHeader title="Thank you" onBack={onBack} />
        </div>
        <div className={`${bodyClass} max-[360px]:text-sm md:text-base`}>
          <div className="rounded-md border border-neutral-200/90 bg-white px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900/60 md:px-8">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              aria-hidden
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">Your message was received.</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
              We review submissions regularly and use them to prioritize product and policy improvements.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={shellClass}>
      <div className="hidden md:block">
        <SecondaryScreenHeader title="Feedback" onBack={onBack} />
      </div>

      <div className={`${bodyClass} max-[360px]:px-0.5 max-[390px]:px-0 max-[430px]:px-0 md:px-0`}>
        <div className="border-b border-neutral-200/90 pb-5 dark:border-slate-800 md:border-0 md:pb-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-500">
            Product feedback
          </p>
          <h1 className="mt-1.5 text-lg font-semibold tracking-tight text-neutral-900 dark:text-slate-100 md:text-xl">
            Share your experience
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
            Describe what worked, what should improve, or any concern. Submissions are stored securely and associated with
            your account so we can follow up when necessary.
          </p>
        </div>

        <div className="rounded-md border border-neutral-200/90 bg-neutral-50/40 px-4 py-5 dark:border-slate-700 dark:bg-slate-900/35 md:px-6 md:py-6">
          <div className="space-y-5">
            <div>
              <label htmlFor="feedback-category" className={labelClass}>
                Topic
              </label>
              <select
                id="feedback-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`${selectClass} py-2.5 pl-3 pr-10 max-[360px]:min-h-11 max-[360px]:py-2 max-[360px]:text-[13px] max-[390px]:text-sm md:max-w-md`}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="feedback-message" className={labelClass}>
                Message
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                maxLength={8000}
                placeholder="What worked well? What felt unclear or missing? Any defects or compliance concerns?"
                className={`${textareaClass} min-h-[10rem] px-3 py-2.5 max-[360px]:min-h-[9rem] max-[360px]:text-[13px] max-[390px]:min-h-[10rem] max-[430px]:min-h-[10.5rem] md:min-h-[12rem]`}
              />
              <div className="mt-1.5 flex justify-end">
                <p className="text-xs tabular-nums text-neutral-500 dark:text-slate-500">{message.length} / 8000</p>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 pt-1 max-[430px]:gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-neutral-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 active:bg-neutral-950 disabled:pointer-events-none disabled:opacity-60 dark:bg-slate-100 dark:text-neutral-950 dark:hover:bg-white dark:active:bg-slate-200 max-[360px]:min-h-12 max-[360px]:text-sm max-[430px]:max-w-none sm:w-auto md:min-h-11"
            disabled={submitting || !token}
            onClick={() => void submit()}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
          {!token ? (
            <p className="text-sm text-amber-800 dark:text-amber-400">Sign in to send feedback.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
