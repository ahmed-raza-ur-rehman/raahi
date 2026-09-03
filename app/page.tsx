import Link from "next/link";

export default function Home() {
  return (
    <main className="app-shell flex min-h-screen flex-col px-5 py-6" dir="rtl">
      <header className="flex items-center justify-between">
        <div className="text-right">
          <p className="text-xl font-black tracking-tight text-[var(--forest)]">راہی</p>
          <p className="text-xs text-[var(--muted)]">Pakistan&apos;s service navigator</p>
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">اردو</span>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16 text-right">
        <span className="mb-5 w-fit rounded-full bg-[#e7f4eb] px-3 py-1 text-sm font-semibold text-[var(--forest)]">Verified guidance, built around you</span>
        <h1 className="text-4xl font-black leading-[1.5] tracking-tight text-[var(--ink)]">بتائیں، آپ کو کیا چاہیے؟</h1>
        <p className="mt-4 max-w-md text-lg leading-8 text-[var(--muted)]">راہی آپ کو سرکاری، فلاحی، صحت اور تعلیم کی خدمات تک قابلِ تصدیق راستہ دکھاتا ہے۔</p>
        <Link className="mt-8 rounded-2xl bg-[var(--forest)] px-5 py-4 text-center text-base font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:bg-[var(--forest-dark)]" href="/chat">
          اپنی ضرورت بتائیں
        </Link>
        <p className="mt-4 text-center text-xs text-[var(--muted)]">English, اردو, پښتو · Sources included · No eligibility guarantees</p>
      </section>

      <footer className="border-t border-[var(--line)] pt-4 text-center text-xs text-[var(--muted)]">RAAHI guides you to verified services. Always confirm with the official source.</footer>
    </main>
  );
}
