"use client";

import SiteHeader from "@/components/SiteHeader";

const faqs = [
  {
    question: "How do I place an order?",
    answer:
      "Browse products in Marketplace, add your item to cart, then proceed to checkout to complete your order.",
  },
  {
    question: "How can I become a seller?",
    answer:
      "Create an account, enable seller role from your account flow, then open Seller Dashboard to add products.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Use the Contact Us page and provide your concern details. Include your account email for faster help.",
  },
  {
    question: "Can I offer services instead of products?",
    answer:
      "Yes. You can list services in your seller dashboard and manage availability from your listing entries.",
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader activePage="faq" />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">FAQ</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Frequently Asked Questions</h1>
        <div className="mt-8 space-y-3">
          {faqs.map((item) => (
            <article key={item.question} className="rounded-2xl border border-slate-200 p-4">
              <h2 className="text-lg font-semibold">{item.question}</h2>
              <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
