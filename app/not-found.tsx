import Link from "next/link";

export const metadata = { title: "Not found — RAAHI" };

const ROUTES = [
  { href: "/ask", en: "Ask a question", ur: "سوال پوچھیں", icon: "🎙️" },
  { href: "/scholarships", en: "Scholarships", ur: "وظائف", icon: "🎓" },
  { href: "/documents", en: "Documents", ur: "دستاویزات", icon: "📄" },
  { href: "/tests", en: "Tests & dates", ur: "ٹیسٹ اور تاریخیں", icon: "📅" },
  { href: "/health", en: "Health & camps", ur: "صحت اور کیمپ", icon: "🏥" },
  { href: "/blood", en: "Blood donors", ur: "خون کے عطیہ دہندگان", icon: "🩸" },
  { href: "/contacts", en: "Emergency numbers", ur: "ہنگامی نمبر", icon: "📞" },
];

export default function NotFound() {
  return (
    <main
      dir="rtl"
      lang="ur"
      className="app-shell min-h-screen px-5 py-10"
    >
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-[var(--line)] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-3xl">
            🔍
          </div>
          <h1 className="mt-4 text-xl font-black text-[var(--ink)]">یہ صفحہ نہیں ملا</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            ہو سکتا ہے لنک پرانا ہو۔ نیچے سے اپنی ضرورت منتخب کریں۔
          </p>
          <p className="mt-2 text-xs text-[var(--muted-light)]">
            We could not find that page. Pick what you need below.
          </p>
        </div>

        <h2 className="mt-6 text-sm font-black text-[var(--ink)]">مدد کے اہم راستے</h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="rounded-2xl border border-[var(--line)] bg-white p-3.5 text-center transition hover:border-[var(--forest)]"
            >
              <span className="text-2xl" aria-hidden>
                {route.icon}
              </span>
              <span className="mt-1.5 block text-sm font-bold text-[var(--ink)]">{route.ur}</span>
              <span className="mt-0.5 block text-[10px] text-[var(--muted-light)]">{route.en}</span>
            </Link>
          ))}
        </div>

        <Link
          href="/"
          className="mt-6 block rounded-xl bg-[var(--forest)] px-4 py-3 text-center text-sm font-black text-white"
        >
          پہلے صفحے پر جائیں · Go home
        </Link>
      </div>
    </main>
  );
}
