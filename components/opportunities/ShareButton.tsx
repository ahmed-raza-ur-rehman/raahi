"use client";

import type { Language } from "@/lib/types";
import { t } from "@/lib/opportunities/i18n";
import { shareText, whatsappUrl } from "@/lib/opportunities/share";
import type { OpportunityView } from "@/lib/opportunities/types";

/** Inline SVG so the icon never depends on a device's symbol fonts. */
function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.6l6.8-4M8.6 13.4l6.8 4" />
    </svg>
  );
}

/**
 * Opens the phone's share sheet when there is one (WhatsApp, Telegram, SMS …), otherwise WhatsApp Web / the app.
 * The absolute link is worked out at click time, so nothing about the visitor is rendered into the page.
 */
export function ShareButton({ item, language, compact = false }: { item: OpportunityView; language: Language; compact?: boolean }) {
  const share = async () => {
    const url = new URL(`/opportunities/${item.id}`, window.location.origin).toString();
    const text = shareText(item, url, language);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: item.title, text: text.replace(url, "").trim(), url });
        return;
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return; // the person closed the sheet
      }
    }
    window.open(whatsappUrl(text), "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={t(language, "share")}
      title={t(language, "share")}
      className={compact ? "flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--forest)] transition hover:bg-[var(--forest-light)]" : "btn-secondary !gap-1.5"}
    >
      <ShareIcon size={compact ? 17 : 16} />
      {!compact && t(language, "share")}
    </button>
  );
}
