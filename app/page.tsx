import Link from "next/link";

const quickNeeds = [
  ["میرے بیٹے کی فیس نہیں ہے", "Education"],
  ["I need a domicile certificate", "Documentation"],
  ["زما پلار ته ډایلسز پکار دی", "Healthcare"],
  ["BISP کے لیے کیسے رجسٹر ہوں", "Welfare"],
  ["سیلاب میں گھر تباہ ہو گیا", "Emergency relief"],
];

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
        <div className="mt-10"><p className="mb-3 text-sm font-bold text-[var(--ink)]">لوگ یہ پوچھتے ہیں</p><div className="grid grid-cols-2 gap-2">{quickNeeds.map(([need, label]) => <Link key={need} href={`/chat?need=${encodeURIComponent(need)}`} className="rounded-xl border border-[var(--line)] p-3 text-right text-sm transition hover:border-[var(--forest)] hover:bg-[#f3faf5]"><span className="block text-xs text-[var(--muted)]">{label}</span><span className="mt-1 block font-semibold leading-6">{need}</span></Link>)}</div></div>
        <Link className="mt-4 text-center text-sm font-bold text-[var(--forest)] underline" href="/cases">میرے کیسز</Link>
        <p className="mt-4 text-center text-xs text-[var(--muted)]">English, اردو, پښتو · Sources included · No eligibility guarantees</p>
      </section>

      <footer className="border-t border-[var(--line)] pt-4 text-center text-xs text-[var(--muted)]">RAAHI guides you to verified services. Always confirm with the official source.</footer>
    </main>
  );
}
