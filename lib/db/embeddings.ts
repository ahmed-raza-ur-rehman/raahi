import { createDashScopeEmbedding } from "@/lib/rag/embeddings";

import { getSqlite } from "./client";

export interface EmbeddingSummary {
  generated: number;
  skipped: number;
}

type ChunkRow = {
  id: string;
  content: string;
};

export async function populateMissingEmbeddings(): Promise<EmbeddingSummary> {
  const database = getSqlite();
  const chunks = database
    .prepare("SELECT id, content FROM knowledge_chunks WHERE embedding IS NULL ORDER BY id")
    .all() as ChunkRow[];
  const updateChunk = database.prepare("UPDATE knowledge_chunks SET embedding = ? WHERE id = ?");
  let generated = 0;

  for (const chunk of chunks) {
    const embedding = await createDashScopeEmbedding(chunk.content);
    if (!embedding) {
      return { generated, skipped: chunks.length - generated };
    }

    updateChunk.run(JSON.stringify(embedding), chunk.id);
    generated += 1;
  }

  return { generated, skipped: 0 };
}
