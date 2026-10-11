import type { OpportunityKind, RawOpportunity, Scope } from "../types";
import type { HttpClient } from "./http";

export type AdapterId =
  | "wordpress"
  | "rss"
  | "scholarshiptab"
  | "njp"
  | "beoe-notices"
  | "remotive"
  | "jobicy"
  | "arbeitnow"
  | "devpost"
  | "codeforces"
  | "realdiscount"
  | "spsc"
  | "bpsc"
  | "etea"
  | "himalayas"
  | "remoteok"
  | "workingnomads"
  | "weworkremotely"
  | "ctftime";

export interface SourceDefinition {
  id: string;
  name: string;
  homepage: string;
  adapter: AdapterId;
  /** Primary endpoint the adapter reads (REST base, feed URL, listing page, API URL). */
  endpoint: string;
  defaultKind: OpportunityKind;
  scope: Scope;
  /** 1 = government/official … 4 = community aggregator. Used to pick the winner when sites list the same item. */
  authority: 1 | 2 | 3 | 4;
  /** Do not hit the source more often than this (Remotive asks for max 4 requests/day). */
  minIntervalMinutes: number;
  /** Default true. Only documented public APIs that publish their own terms may set false. */
  respectRobots?: boolean;
  maxItems?: number;
  enabled: boolean;
  /** Why a source is switched off (shown on the status page instead of a silent gap). */
  disabledReason?: string;
  /**
   * Set when the site cannot be reached from GitHub's servers (it times out or refuses datacenter traffic) and
   * needs a connection inside that country. Such a source is skipped unless the run is told it is on that
   * network (`--region pk` / `RAAHI_REGION=pk`) or the source is named explicitly with `--only`.
   */
  network?: "pk";
  /**
   * True when the parser was written from the rendered page rather than a documented API.
   * These are the first to check if a run reports `empty` or `error`.
   */
  experimental?: boolean;
  /** Directory resource this source belongs to. */
  resourceId?: string;
  /** Credit line shown wherever items from this source appear. */
  attribution: string;
  /** Short note on terms of use we are honouring. */
  terms?: string;
  params?: Record<string, string | number | boolean>;
  requiresEnv?: string[];
  /**
   * Hours to keep an item that the source stopped listing. `0` drops it at once (right for
   * 100%-off coupons, which disappear when they sell out); undefined = keep until its own expiry.
   */
  retainHours?: number;
}

export interface AdapterContext {
  source: SourceDefinition;
  http: HttpClient;
  now: Date;
  log: (message: string) => void;
}

export type Adapter = (context: AdapterContext) => Promise<RawOpportunity[]>;
