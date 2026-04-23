"use client";

import SiteHeader from "@/components/SiteHeader";

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader activePage="about-us" />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">About us</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Building a trusted local marketplace</h1>
        <p className="mt-5 text-base leading-relaxed text-slate-700">
          CPR Marketplace connects homeowners, local sellers, and service providers in one platform.
          We focus on nearby discovery, transparent listings, and a simple buying experience to help
          communities support each other.
        </p>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold">Our mission</h2>
            <p className="mt-2 text-sm text-slate-600">
              Empower neighborhoods through accessible commerce and reliable local services.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold">Our values</h2>
            <p className="mt-2 text-sm text-slate-600">
              Trust, convenience, and fairness for buyers, sellers, and service providers.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold">Our community</h2>
            <p className="mt-2 text-sm text-slate-600">
              Supporting local entrepreneurs and helping residents discover useful nearby offerings.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
