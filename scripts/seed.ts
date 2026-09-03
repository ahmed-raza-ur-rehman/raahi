import { seedDatabase } from "../lib/db/seed";

const summary = seedDatabase();
console.log(`Seeded ${summary.services} services from ${summary.organizations} organizations.`);
console.log(`Sources: ${summary.sources}; rules: ${summary.eligibilityRules}; chunks: ${summary.knowledgeChunks}.`);
