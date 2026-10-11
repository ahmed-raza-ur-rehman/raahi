import type { Adapter, AdapterId } from "../types";
import { arbeitnowAdapter, codeforcesAdapter, devpostAdapter, jobicyAdapter, realDiscountAdapter, remotiveAdapter } from "./apis";
import { rssAdapter, wordpressAdapter } from "./feeds";
import { beoeNoticesAdapter, njpAdapter, scholarshipTabAdapter } from "./html";
import { bpscAdapter, eteaAdapter, spscAdapter } from "./pk";
import { ctftimeAdapter, himalayasAdapter, remoteOkAdapter, weWorkRemotelyAdapter, workingNomadsAdapter } from "./remote";

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
  spsc: spscAdapter,
  bpsc: bpscAdapter,
  etea: eteaAdapter,
  himalayas: himalayasAdapter,
  remoteok: remoteOkAdapter,
  workingnomads: workingNomadsAdapter,
  weworkremotely: weWorkRemotelyAdapter,
  ctftime: ctftimeAdapter,
};
