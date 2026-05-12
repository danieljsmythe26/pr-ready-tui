import type { PR, ReviewComment, ConversationComment } from '../types.js';

export interface DetailPayload {
  reviewComments: ReviewComment[];
  structuredConversationComments: ConversationComment[];
  commitDates: { author: string; date: string }[];
  conversationComments: string;
}

interface CacheEntry {
  updatedAt: string;
  detail: DetailPayload;
}

// Module-level cache + abort manager. Survives across hook unmount/remount
// for the lifetime of the TUI process. Reset is exposed for tests.
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, AbortController>();

export function keyFor(pr: Pick<PR, 'repo' | 'number'>): string {
  return `${pr.repo.owner}/${pr.repo.repo}/${pr.number}`;
}

export function getCached(key: string, updatedAt: string): DetailPayload | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.updatedAt !== updatedAt) return undefined;
  return entry.detail;
}

export function setCached(key: string, updatedAt: string, detail: DetailPayload): void {
  cache.set(key, { updatedAt, detail });
}

export function getInflight(key: string): AbortController | undefined {
  return inflight.get(key);
}

/**
 * Register a new in-flight fetch for `key`, aborting any prior one.
 * Returns the new controller.
 */
export function startInflight(key: string): AbortController {
  const prior = inflight.get(key);
  if (prior) prior.abort();
  const controller = new AbortController();
  inflight.set(key, controller);
  return controller;
}

export function clearInflight(key: string, controller: AbortController): void {
  if (inflight.get(key) === controller) inflight.delete(key);
}

export const __testing = {
  resetAll(): void {
    cache.clear();
    for (const c of inflight.values()) c.abort();
    inflight.clear();
  },
  cacheSize(): number { return cache.size; },
  inflightSize(): number { return inflight.size; },
};
