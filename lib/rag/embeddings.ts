import { getDashScopeClient } from "@/lib/ai/client";
import { withProvider } from "@/lib/ai/resilience";

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct / Math.sqrt(leftMagnitude * rightMagnitude);
}

export async function createDashScopeEmbedding(input: string) {
  const client = getDashScopeClient();
  if (!client) {
    return undefined;
  }

  // Plan B: `undefined` means "no vector available", and every caller already
  // falls back to full-text / keyword ranking. The breaker keeps a broken
  // provider from slowing those calls down.
  return withProvider<number[] | undefined>("dashscope-embeddings", {
    timeoutMs: 10_000,
    label: "embed",
    call: async () => {
      const response = await client.embeddings.create({
        model: "text-embedding-v3",
        input,
      });
      return response.data[0]?.embedding;
    },
    fallback: () => undefined,
  });
}


