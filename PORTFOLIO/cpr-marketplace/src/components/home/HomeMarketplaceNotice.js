export default function HomeMarketplaceNotice({ notice, onDismiss }) {
  if (!notice) return null;
  return (
    <section className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
      <p>{notice}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close notification"
        className="text-base font-semibold leading-none text-teal-700 hover:text-teal-900"
      >
        &times;
      </button>
    </section>
  );
}
