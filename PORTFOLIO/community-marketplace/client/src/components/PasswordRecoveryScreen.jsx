import { useCallback, useEffect, useState } from "react";
import { createSupabaseClient } from "../lib/supabaseClient.js";
import { validateConfirmPassword, validatePasswordClient } from "../lib/formValidation.js";
import { EyeHidePasswordIcon, EyeShowPasswordIcon } from "./landing/LandingMarketing.jsx";

/**
 * Full-screen password reset after user follows Supabase recovery email link (`/auth/recovery`).
 */
export function PasswordRecoveryScreen({ navigate }) {
  const [checked, setChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [noClient, setNoClient] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseClient();
    if (!supabase) {
      setNoClient(true);
      setChecked(true);
      return undefined;
    }
    let cancelled = false;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(Boolean(data?.session?.user));
      setChecked(true);
    };
    void syncSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setHasSession(Boolean(session?.user));
      setChecked(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = useCallback(async () => {
    const supabase = createSupabaseClient();
    if (!supabase) return;
    setError("");
    const pErr = validatePasswordClient(newPassword, { signup: true });
    if (pErr) {
      setError(pErr);
      return;
    }
    const cErr = validateConfirmPassword(newPassword, confirmPassword);
    if (cErr) {
      setError(cErr);
      return;
    }
    setSubmitting(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;
      setDone(true);
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        navigate("/", { replace: true });
      }, 1600);
    } catch (e) {
      setError(e?.message || "Could not update password. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [navigate, newPassword, confirmPassword]);

  if (noClient) {
    return (
      <div className="landing-shell flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
        <div className="landing-card w-full max-w-md px-6 py-8 text-center">
          <p className="text-sm text-neutral-600 dark:text-slate-400">
            Password reset is not available. The app is missing Supabase configuration.
          </p>
          <button type="button" className="landing-btn-primary mt-6 w-full" onClick={() => navigate("/", { replace: true })}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!checked) {
    return (
      <div className="landing-shell flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
        <p className="text-sm text-neutral-600 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="landing-shell flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
        <div className="landing-card w-full max-w-md px-6 py-8 text-center">
          <h1 className="mobile-page-title text-neutral-900 dark:text-slate-100">Link invalid or expired</h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
            Open the reset link from your email again, or request a new password reset from the log-in screen.
          </p>
          <button type="button" className="landing-btn-primary mt-6 w-full" onClick={() => navigate("/", { replace: true })}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="landing-shell flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
        <div className="landing-card w-full max-w-md px-6 py-10 text-center">
          <p className="text-base font-semibold text-neutral-900 dark:text-slate-100">Password saved</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">Taking you to LinkMart…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-shell flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
      <div className="landing-card w-full max-w-md px-6 py-8">
        <h1 className="mobile-page-title text-neutral-900 dark:text-slate-100">Set a new password</h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
          Choose a strong password you haven&apos;t used elsewhere.
        </p>

        <form
          className="mt-8 space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label htmlFor="recovery-new-password" className="label-base">
              New password
            </label>
            <div className="relative">
              <input
                id="recovery-new-password"
                name="newPassword"
                className="landing-input pr-11"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError("");
                }}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/35 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
                aria-pressed={showNew}
              >
                {showNew ? <EyeHidePasswordIcon /> : <EyeShowPasswordIcon />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="recovery-confirm-password" className="label-base">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="recovery-confirm-password"
                name="confirmPassword"
                className="landing-input pr-11"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/35 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                aria-pressed={showConfirm}
              >
                {showConfirm ? <EyeHidePasswordIcon /> : <EyeShowPasswordIcon />}
              </button>
            </div>
          </div>

          {error ? (
            <p className="field-error-text" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="landing-btn-primary w-full" disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
