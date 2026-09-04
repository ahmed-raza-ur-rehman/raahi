import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { searchServicesHybrid } from "@/lib/rag/search";
import { detectLanguage } from "@/lib/ai/language";
import { detectSafetySignals } from "@/lib/safety/detect";
import { getDashScopeClient } from "@/lib/ai/client";
import type { CitizenProfile, Language } from "@/lib/types";

const schema = z.object({ message: z.string().trim().min(2).max(2000), language: z.enum(["en", "ur", "ps"]).optional(), profile: z.record(z.string(), z.unknown()).default({}) });
async function composeWithQwen(language: Language, results: Awaited<ReturnType<typeof searchServicesHybrid>>) {
	const client = getDashScopeClient();
	if (!client || results.length === 0) return undefined;
	const context = results.map((result) => `${result.service.name}: ${result.service.description} [${result.citation.sourceTitle}, ${result.citation.sourceUrl}]`).join("\n");
	try {
		const response = await client.chat.completions.create({ model: "qwen-max", temperature: 0.1, messages: [{ role: "system", content: "You are RAAHI. Summarize only the supplied source-grounded routes. Never claim eligibility, invent facts, diagnose, or give legal advice. Keep it short and actionable. Respond in the requested language." }, { role: "user", content: `Language: ${language}\nVerified routes:\n${context}` }] });
		const content = response.choices[0]?.message.content;
		return typeof content === "string" ? content : undefined;
	} catch {
		return undefined;
	}
}

export async function POST(request: Request) { const parsed = schema.safeParse(await request.json().catch(() => undefined)); if (!parsed.success) return NextResponse.json({ error: "Please describe what you need." }, { status: 400 }); ensureDatabaseSeeded(); const { message, profile, language: requested } = parsed.data; const language: Language = detectLanguage(message, requested); const safety = detectSafetySignals(message); if (safety.emergency) return NextResponse.json({ language, emergency: true, message: language === "en" ? "If anyone is in immediate danger, call Rescue 1122, Edhi 115, or Police 15 now. I can help you find follow-up services after you are safe." : language === "ps" ? "که سمدستي خطر وي، اوس 1122، ایدهي 115 یا پولیس 15 ته زنګ ووهئ." : "اگر فوری خطر ہے تو ابھی ریسکیو 1122، ایدھی 115 یا پولیس 15 پر کال کریں۔ محفوظ ہونے کے بعد میں مزید خدمات تلاش کرنے میں مدد کر سکتا ہوں۔", results: [] }); const results = await searchServicesHybrid({ query: message, province: typeof profile.province === "string" ? profile.province : undefined, limit: 5 }); const fallback = results.length ? (language === "en" ? "Here are verified routes that may help. Please confirm details with each source." : language === "ps" ? "دا تایید شوې لارې دي چې مرسته کولی شي. جزئیات له هرې سرچینې سره تایید کړئ." : "یہ تصدیق شدہ راستے آپ کی مدد کر سکتے ہیں۔ تفصیلات ہر ذریعے سے ضرور تصدیق کریں۔") : (language === "en" ? "I do not have verified information for this request yet." : "اس درخواست کے لیے میرے پاس ابھی تصدیق شدہ معلومات نہیں ہیں۔"); return NextResponse.json({ language, emergency: false, medical: safety.medical, legal: safety.legal, message: (await composeWithQwen(language, results)) ?? fallback, results: results.map((result) => ({ ...result, eligibility: { status: "possible", confidenceReason: "The issuing authority makes the final decision." } })) }); }