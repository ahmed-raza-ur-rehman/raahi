"use client";

import Link from "next/link";
import type { Language } from "@/lib/types";
import { FUNDING_LABELS, LEVEL_LABELS, countryLabel, pick, t } from "@/lib/opportunities/i18n";
import type { OpportunityView } from "@/lib/opportunities/types";
import { deadlineInfo } from "./format";
import { ShareButton } from "./ShareButton";
import { Chip, KindBadge, StarIcon } from "./ui";

interface Props {
  item: OpportunityView;
  language: Language;
  saved: boolean;
  onToggleSave: (item: OpportunityView) => void;
}

export function OpportunityCard({ item, language, saved, onToggleSave }: Props) {
  const deadline = deadlineInfo(item, language);
  const extra = item.extra ?? {};
  const place = item.remote ? t(language, "remote") : item.country ? countryLabel(language, item.country) : undefined;
  const facts: string[] = [];
  if (typeof extra.grade === "string") facts.push(`${t(language, "grade")} ${extra.grade}`);
  if (typeof extra.vacancies === "number") facts.push(`${t(language, "vacancies")}: ${extra.vacancies}`);
  if (typeof extra.salary === "string") facts.push(`${t(language, "salary")}: ${extra.salary}`);
  if (typeof extra.prize === "string") facts.push(`${t(language, "prize")}: ${extra.prize}`);
  if (typeof extra.listPrice === "number") facts.push(`${t(language, "listPrice")} $${extra.listPrice}`);

  return (
    <article className="card flex flex-col gap-3 p-4" aria-labelledby={`opp-${item.id}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <KindBadge kind={item.kind} language={language} />
        {place && <Chip>{item.scope === "pakistan" ? "🇵🇰" : "🌍"} {place}</Chip>}
        {item.isNew && <Chip tone="ok">✨ {t(language, "badgeNew")}</Chip>}
        {item.openToPakistan === false && <Chip tone="closed" title={item.eligibilityNote}>⚠️ {t(language, "notOpenToPk")}</Chip>}
        {item.openToPakistan === true && item.scope === "international" && <Chip tone="ok" title={item.eligibilityNote}>✓ {t(language, "openToPk")}</Chip>}
      </div>

      <div>
        <h3 id={`opp-${item.id}`} className="text-[15px] font-black leading-snug text-[var(--ink)]" dir="auto">
          <Link href={`/opportunities/${item.id}`} className="hover:text-[var(--forest)] hover:underline">{item.title}</Link>
        </h3>
        {item.organization && <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]" dir="auto">{item.organization}</p>}
      </div>

      {item.summary && <p className="line-clamp-3 text-[13px] leading-relaxed text-[var(--ink-soft)]" dir="auto">{item.summary}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone={deadline.tone}>⏳ {deadline.text}</Chip>
        {item.funding && item.funding !== "unknown" && <Chip>💵 {pick(language, FUNDING_LABELS[item.funding])}</Chip>}
        {item.levels.slice(0, 2).map((level) => <Chip key={level}>{pick(language, LEVEL_LABELS[level])}</Chip>)}
        {facts.map((fact) => <Chip key={fact}>{fact}</Chip>)}
      </div>

      {item.kind === "coupon" && <p className="text-[11px] text-[var(--amber)]">{t(language, "couponWarn")}</p>}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line-soft)] pt-3">
        <p className="text-[11px] text-[var(--muted)]">
          {t(language, "viaSource")} <span className="font-bold text-[var(--ink-soft)]">{item.sourceName}</span>
          {item.alsoOn && item.alsoOn.length > 0 && <span title={item.alsoOn.map((a) => a.sourceName).join(", ")}> +{item.alsoOn.length}</span>}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleSave(item)}
            aria-pressed={saved}
            aria-label={saved ? t(language, "saved") : t(language, "save")}
            title={saved ? t(language, "saved") : t(language, "save")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-lg leading-none text-[var(--amber)] transition hover:bg-[var(--amber-bg)]"
          >
            <StarIcon filled={saved} />
          </button>
          <ShareButton item={item} language={language} compact />
          <Link href={`/opportunities/${item.id}`} className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">{t(language, "details")}</Link>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-primary !min-h-9 !px-3 !py-1.5 !text-xs">{t(language, "openSource")} ↗</a>
        </div>
      </div>
    </article>
  );
}
