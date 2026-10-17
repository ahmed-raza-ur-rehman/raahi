/**
 * Print today's digest — what is closing, what is new, which yearly programmes to act on — and optionally post it
 * to a Telegram channel.
 *
 *   npm run digest                       # English, printed to the terminal (WhatsApp-ready text)
 *   npm run digest -- --lang ur          # Urdu headings
 *   npm run digest -- --telegram         # also post it (needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)
 *   npm run digest -- --max 1500         # shorter, e.g. for a WhatsApp share link
 *
 * It reads the snapshot committed in this repository, so run it after `npm run scrape`. Links point at the site named
 * by SITE_URL (or NEXT_PUBLIC_SITE_URL). Nothing is posted unless `--telegram` is given AND both secrets are set.
 */
import { appendFileSync } from "node:fs";
import { buildDigest } from "../lib/opportunities/digest";
import { configuredOrigin } from "../lib/opportunities/site";
import { ensureOpportunitiesReady } from "../lib/opportunities/store";

function parseArgs(argv: string[]) {
  const args = { language: "en" as "en" | "ur", telegram: false, max: 3800 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--lang") args.language = argv[(index += 1)] === "ur" ? "ur" : "en";
    else if (arg === "--telegram") args.telegram = true;
    else if (arg === "--max") args.max = Math.min(Math.max(Number(argv[(index += 1)]) || 3800, 600), 4000);
  }
  return args;
}

async function postToTelegram(html: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.error("--telegram needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID; nothing was posted.");
    process.exitCode = 1;
    return;
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    // The token is never printed; Telegram's own error text says what is wrong (bad chat id, bot not an admin …).
    console.error(`Telegram answered HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    process.exitCode = 1;
    return;
  }
  console.log("Posted to Telegram.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const origin = configuredOrigin() ?? "http://localhost:3000";
  if (!configuredOrigin()) console.error("SITE_URL is not set; links use http://localhost:3000.");

  ensureOpportunitiesReady();
  const digest = buildDigest({ origin, language: args.language, maxChars: args.max });
  console.log(digest.text);

  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Digest\n\n\`\`\`\n${digest.text}\n\`\`\`\n`);
  if (args.telegram) await postToTelegram(digest.html);
}

void main();
