import type { Adapter, AdapterId } from "../types";
import { arbeitnowAdapter, codeforcesAdapter, devpostAdapter, jobicyAdapter, realDiscountAdapter, remotiveAdapter } from "./apis";
import { rssAdapter, wordpressAdapter } from "./feeds";
import { beoeNoticesAdapter, njpAdapter, scholarshipTabAdapter } from "./html";

export const ADAPTERS: Record<AdapterId, Adapter> = {
  wordpress: wordpressAdapter,
  rss: rssAdapter,
  scholarshiptab: scholarshipTabAdapter,
  njp: njpAdapter,
  "beoe-notices": beoeNoticesAdapter,
  remotive: remotiveAdapter,
  jobicy: jobicyAdapter,
  arbeitnow: arbeitnowAdapter,
  devpost: devpostAdapter,
  codeforces: codeforcesAdapter,
  realdiscount: realDiscountAdapter,
};
