import Link from "next/link";

export const metadata = { title: "Offline — RAAHI" };

/**
 * Shown by the service worker when a page is requested with no connection and
 * nothing cached. It must be useful without any data of its own, so it points
 * at the emergency numbers that matter most when someone is stuck.
 */
export default function OfflinePage() {
  return (
    <main
      dir="rtl"
      lang="ur"
      className="app-shell flex min-h-screen items-center justify-center px-5 py-10"
    >
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--forest-light)] text-3xl">
          📶
        </div>

        <h1 className="mt-4 text-xl font-black text-[var(--ink)]">
          انٹرنیٹ دستیاب نہیں
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          رابطہ منقطع ہے۔ آپ نے پہلے دیکھی ہوئی صفحات اب بھی کھل جائیں گی۔
        </p>

        <p className="mt-4 text-xs leading-relaxed text-[var(--muted-light)]">
          No internet connection. Pages you have already opened will still work.
        </p>

        <div className="mt-6 rounded-2xl bg-rose-50 p-4 text-right">
          <p className="text-sm font-black text-rose-800">فوری مدد کے لیے</p>
          <p className="mt-1 text-xs text-rose-700">For immediate help, call:</p>
          <a
            href="tel:1122"
            className="mt-2 block rounded-xl bg-rose-600 px-4 py-2.5 text-center text-base font-black text-white"
          >
            1122 — ریسکیو / Rescue
          </a>
        </div>

        <Link
          href="/"
          className="mt-5 inline-block rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-bold text-[var(--forest)]"
        >
          دوبارہ کوشش کریں · Try again
        </Link>
      </div>
    </main>
  );
}
