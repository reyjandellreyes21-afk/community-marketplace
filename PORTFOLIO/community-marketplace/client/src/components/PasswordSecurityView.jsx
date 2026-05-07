import { useCallback, useState } from "react";
import { EyeHidePasswordIcon, EyeShowPasswordIcon } from "./landing/LandingMarketing.jsx";
import { apiRequest } from "../lib/appApi.js";
import { UI_KIT } from "../lib/appUiKit.js";
import { validateConfirmPassword, validatePasswordClient } from "../lib/formValidation.js";
import { SecondaryScreenHeader } from "./SecondaryScreenHeader.jsx";

/**
 * Logged-in screen: change password (email/password accounts).
 */
export function PasswordSecurityView({ token, onBack }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const shellClass = `${UI_KIT.viewSection} mx-auto w-full max-w-2xl pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch] md:mx-0 md:w-full md:max-w-none md:min-h-[calc(100dvh-7.75rem-env(safe-area-inset-bottom,0px))] md:flex md:flex-col`;
  const bodyClass =
    "space-y-4 max-[360px]:space-y-3.5 max-[390px]:space-y-4 max-[430px]:space-y-4 md:flex-1 md:space-y-6";

  const submit = useCallback(async () => {
    if (!token) return;
    setError("");
    if (!String(currentPassword || "").trim()) {
      setError("Enter your current password.");
      return;
    }
    if (String(currentPassword || "").length < 8) {
      setError("Current password must be at least 8 characters.");
      return;
    }
    const nextErr = validatePasswordClient(newPassword, { signup: true });
    if (nextErr) {
      setError(nextErr);
      return;
    }
    const matchErr = validateConfirmPassword(newPassword, confirmPassword);
    if (matchErr) {
      setError(matchErr);
      return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest("/auth/me/password", {
        method: "PATCH",
        token,
        body: { currentPassword, newPassword },
      });
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e?.message || "Could not update password. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [token, currentPassword, newPassword, confirmPassword]);

  if (done) {
    return (
      <section className={`${shellClass} md:flex-1`}>
        <div className="hidden md:block">
          <SecondaryScreenHeader title="Password & security" onBack={onBack} />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-2 py-10 text-center max-[360px]:py-8 md:min-h-0 md:flex-[1_1_auto] md:px-4 md:py-12">
          <div
            className="mb-5 flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-brand-soft shadow-inner ring-1 ring-inset ring-brand-primary/20 dark:bg-slate-800/80 dark:ring-brand-accent/25"
            aria-hidden
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 text-brand-primary dark:text-brand-accent"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-slate-100 md:text-xl">
            Password updated
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-600 dark:text-slate-300 md:mt-3 md:text-[15px] md:leading-relaxed">
            Your new password is saved. Use it the next time you sign in here or on another device.
          </p>
          <button
            type="button"
            className="btn-primary mt-8 min-h-11 w-full max-w-[min(100%,20rem)] px-6 shadow-md shadow-brand-primary/20 dark:shadow-brand-accent/10"
            onClick={() => {
              setDone(false);
              onBack?.();
            }}
          >
            Done
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={shellClass}>
      <div className="hidden md:block">
        <SecondaryScreenHeader title="Password & security" onBack={onBack} />
      </div>

      <div className={`${bodyClass} max-[360px]:px-0.5 max-[390px]:px-0 max-[430px]:px-0 md:px-0`}>
        <p className="text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[360px]:leading-snug max-[390px]:text-[14px] max-[430px]:text-[15px] md:text-sm dark:text-slate-300">
          For accounts that use email and password, you can set a new password here. If you usually sign in with Google,
          password change isn’t available for your account.
        </p>

        <div className="space-y-2 max-[360px]:space-y-1.5">
          <label htmlFor="pwd-current" className="text-sm font-medium text-neutral-800 max-[360px]:text-[13px] dark:text-slate-200">
            Current password
          </label>
          <div className="relative">
            <input
              id="pwd-current"
              name="currentPassword"
              className="input-base w-full py-2.5 pl-3 pr-11 text-sm max-[360px]:min-h-11 max-[360px]:py-2 max-[360px]:text-[13px]"
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError("");
              }}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              onClick={() => setShowCurrent((v) => !v)}
              aria-label={showCurrent ? "Hide password" : "Show password"}
              aria-pressed={showCurrent}
            >
              {showCurrent ? <EyeHidePasswordIcon /> : <EyeShowPasswordIcon />}
            </button>
          </div>
        </div>

        <div className="space-y-2 max-[360px]:space-y-1.5">
          <label htmlFor="pwd-new" className="text-sm font-medium text-neutral-800 max-[360px]:text-[13px] dark:text-slate-200">
            New password
          </label>
          <div className="relative">
            <input
              id="pwd-new"
              name="newPassword"
              className="input-base w-full py-2.5 pl-3 pr-11 text-sm max-[360px]:min-h-11 max-[360px]:py-2 max-[360px]:text-[13px]"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError("");
              }}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              onClick={() => setShowNew((v) => !v)}
              aria-label={showNew ? "Hide new password" : "Show new password"}
              aria-pressed={showNew}
            >
              {showNew ? <EyeHidePasswordIcon /> : <EyeShowPasswordIcon />}
            </button>
          </div>
        </div>

        <div className="space-y-2 max-[360px]:space-y-1.5">
          <label htmlFor="pwd-confirm" className="text-sm font-medium text-neutral-800 max-[360px]:text-[13px] dark:text-slate-200">
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="pwd-confirm"
              name="confirmPassword"
              className="input-base w-full py-2.5 pl-3 pr-11 text-sm max-[360px]:min-h-11 max-[360px]:py-2 max-[360px]:text-[13px]"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError("");
              }}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              aria-pressed={showConfirm}
            >
              {showConfirm ? <EyeHidePasswordIcon /> : <EyeShowPasswordIcon />}
            </button>
          </div>
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
            {submitting ? "Updating…" : "Update password"}
          </button>
          {!token ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">Sign in to change your password.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
