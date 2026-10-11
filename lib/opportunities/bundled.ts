import data from "@/data/opportunities/snapshot.json";
import { parseSnapshot } from "./snapshot";
import type { Snapshot } from "./types";

/**
 * The snapshot committed to the repository (`data/opportunities/snapshot.json`), imported statically so
 * it ships inside the serverless bundle. The scheduled GitHub Action keeps this file fresh; the
 * optional runtime refresh in store.ts can supersede it between deploys.
 */
let cached: Snapshot | undefined;

export function bundledSnapshot(): Snapshot {
  cached ??= parseSnapshot(data as unknown).snapshot;
  return cached;
}
