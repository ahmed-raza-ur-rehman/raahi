import Link from "next/link";

export default function OpportunityNotFound() {
  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" dir="rtl">
      <span className="text-4xl" aria-hidden>🔎</span>
      <h1 className="text-xl font-black text-[var(--ink)]">یہ فہرست ختم ہو چکی ہے یا موجود نہیں</h1>
      <p className="max-w-md text-sm text-[var(--muted)]" dir="ltr">This listing has expired or does not exist. Listings are removed shortly after their deadline.</p>
      <Link href="/opportunities" className="btn-primary">تمام مواقع / All opportunities</Link>
    </main>
  );
}
