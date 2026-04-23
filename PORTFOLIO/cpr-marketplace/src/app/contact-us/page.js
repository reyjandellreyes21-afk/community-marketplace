"use client";

import SiteHeader from "@/components/SiteHeader";

export default function ContactUsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader activePage="contact-us" />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">Contact Us</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">We are here to help</h1>
        <p className="mt-4 text-base text-slate-700">
          Reach out for order concerns, seller onboarding, technical issues, and partnership inquiries.
        </p>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold">Support channels</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Email: reyjandellreyes21@gmail.com</li>
              <li>Phone: +63 900 000 0000</li>
              <li>Hours: Monday to Saturday, 8:00 AM - 6:00 PM</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold">Address</h2>
            <p className="mt-3 text-sm text-slate-600">
              CPR Marketplace Office
              <br />
              Community Business District
              <br />
              Calamba City, Philippines
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
