"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown when a page throws. It is bilingual and needs no data of its own,
 * because the whole point is that it renders when everything else failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the trail: silent failures are impossible to fix.
    console.error("[raahi] page error", error);
  }, [error]);

  return (
    <main
      dir="rtl"
      lang="ur"
      className="app-shell flex min-h-screen items-center justify-center px-5 py-10"
    >
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-3xl">
          ⚠️
        </div>

        <h1 className="mt-4 text-xl font-black text-[var(--ink)]">کچھ غلط ہو گیا</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          اس صفحے کو لوڈ کرتے وقت مسئلہ آیا۔ آپ کی محفوظ کردہ درخواستیں محفوظ ہیں۔
        </p>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted-light)]">
          Something went wrong loading this page. Anything you saved is safe.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-[var(--forest)] px-4 py-3 text-sm font-black text-white"
          >
            دوبارہ کوشش کریں · Try again
          </button>
          <Link
            href="/"
            className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-[var(--forest)]"
          >
            پہلے صفحے پر جائیں · Go home
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-4 text-[10px] text-[var(--muted-light)]">Ref: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
