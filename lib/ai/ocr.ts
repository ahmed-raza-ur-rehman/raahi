import { getDashScopeClient } from "./client";

export interface OcrResult { documentType: string; confidence: number; fields: Record<string, string>; simulated: boolean }
export async function processDocument(imageBase64: string): Promise<OcrResult> {
  if (!getDashScopeClient()) return { documentType: "cnic", confidence: 0.35, fields: { note: "Demo extraction only. Confirm every field before saving.", cnic_number: "XXXXX-XXXXXXX-X" }, simulated: true };
  const response = await getDashScopeClient()!.chat.completions.create({ model: "qwen-vl-max", messages: [{ role: "user", content: [{ type: "text", text: "Analyze this Pakistani document. Return JSON only with documentType, confidence, and fields. Mask any CNIC number except the first five and last digit." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }] }] });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("OCR returned no structured result.");
  const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")) as Partial<OcrResult>;
  return { documentType: parsed.documentType ?? "other", confidence: parsed.confidence ?? 0, fields: parsed.fields ?? {}, simulated: false };
}