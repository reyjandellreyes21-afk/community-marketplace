"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import SiteHeader from "@/components/SiteHeader";
import { loadPersistedState } from "@/lib/cprMarketplaceStorage";

export default function UsersPage() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const onSync = () => refresh();
    window.addEventListener("cpr-marketplace-state-changed", onSync);
    return () => window.removeEventListener("cpr-marketplace-state-changed", onSync);
  }, [refresh]);

  const snapshot = useMemo(() => loadPersistedState(), [tick]);
  const users = snapshot?.users ?? [];

  if (!isClient) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader activePage="" />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everyone registered in this demo marketplace ({users.length} total).
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-200">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
                    {user.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{user.name || "—"}</p>
                    <p className="truncate text-sm text-slate-500">{user.email || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {(user.roles ?? []).map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                    >
                      {role}
                    </span>
                  ))}
                  {user.roles?.includes("seller") && (
                    <Link
                      href={`/seller/${user.id}`}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-600 hover:underline"
                    >
                      View profile
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!users.length && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No users yet.</p>
          )}
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Passwords are never shown. Data is stored locally in your browser for this demo.
        </p>
      </main>
    </div>
  );
}
