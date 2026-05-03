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

  /** Body spacing tuned for 360 / 390 / 430 and md+ web card */
  const bodyClass =
    "space-y-4 max-[360px]:space-y-3.5 max-[390px]:space-y-4 max-[430px]:space-y-4 md:flex-1 md:space-y-6";

  if (done) {
    return (
      <section className={shellClass}>
        <div className="hidden md:block">
          <SecondaryScreenHeader title="Thank you" onBack={onBack} />
        </div>
        <div className={`${bodyClass} max-[360px]:text-sm md:text-base`}>
          <p className="text-sm leading-relaxed text-neutral-600 max-[360px]:leading-snug max-[390px]:text-[15px] md:text-base dark:text-slate-300">
            Your feedback was submitted. We read every message and use it to improve LinkMart.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={shellClass}>
      <div className="hidden md:block">
        <SecondaryScreenHeader title="Send feedback" onBack={onBack} />
      </div>

      <div
        className={`${bodyClass} max-[360px]:px-0.5 max-[390px]:px-0 max-[430px]:px-0 md:px-0`}
      >
        <p className="text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[360px]:leading-snug max-[390px]:text-[14px] max-[430px]:text-[15px] md:text-sm dark:text-slate-300">
          Tell us about your experience with the app, what we should improve, or any concern. Your message is stored securely
          and linked to your account so we can follow up if needed.
        </p>

        <div className="space-y-2 max-[360px]:space-y-1.5">
          <label htmlFor="feedback-category" className="text-sm font-medium text-neutral-800 max-[360px]:text-[13px] dark:text-slate-200">
            Topic
          </label>
          <select
            id="feedback-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-base w-full py-2.5 pl-3 pr-10 text-sm max-[360px]:min-h-11 max-[360px]:py-2 max-[360px]:text-[13px] max-[390px]:text-sm md:max-w-md"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 max-[360px]:space-y-1.5">
          <label htmlFor="feedback-message" className="text-sm font-medium text-neutral-800 max-[360px]:text-[13px] dark:text-slate-200">
            Your feedback
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            maxLength={8000}
            placeholder="What worked well? What felt confusing or missing? Any bugs or concerns?"
            className="input-base min-h-[10rem] w-full resize-y px-3 py-2.5 text-sm leading-relaxed max-[360px]:min-h-[9rem] max-[360px]:text-[13px] max-[390px]:min-h-[10rem] max-[430px]:min-h-[10.5rem] md:min-h-[12rem]"
          />
          <p className="text-xs text-neutral-500 max-[360px]:text-[11px] dark:text-slate-400">
            {message.length} / 8000
          </p>
        </div>

        {error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 max-[430px]:gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            className="btn-primary min-h-11 w-full px-5 max-[360px]:min-h-12 max-[360px]:text-sm max-[430px]:max-w-none sm:w-auto md:min-h-11 disabled:pointer-events-none disabled:opacity-60"
            disabled={submitting || !token}
            onClick={() => void submit()}
          >
            {submitting ? "Sending…" : "Submit feedback"}
          </button>
          {!token ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">Sign in to send feedback.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
