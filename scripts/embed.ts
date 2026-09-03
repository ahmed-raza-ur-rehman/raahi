import { populateMissingEmbeddings } from "../lib/db/embeddings";

const summary = await populateMissingEmbeddings();
console.log(`Generated ${summary.generated} embeddings; skipped ${summary.skipped}.`);
