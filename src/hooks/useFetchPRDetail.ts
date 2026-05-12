import { useEffect } from 'react';
import type { PR } from '../types.js';
import {
  getReviewComments,
  getStructuredConversationComments,
  getCommitDates,
  structuredToConversationString,
} from '../github.js';
import { computeScore } from '../scoring.js';
import {
  keyFor,
  getCached,
  setCached,
  startInflight,
  clearInflight,
  type DetailPayload,
} from './prDetailCache.js';

type UpdatePRFn = (
  repoOwner: string,
  repoName: string,
  number: number,
  patch: Partial<PR>,
) => void;

function buildPatch(pr: PR, detail: DetailPayload): Partial<PR> {
  const sb = computeScore({ ...pr, ...detail });
  return {
    ...detail,
    detailLoaded: true,
    score: sb.total,
    scoreBreakdown: sb,
  };
}

const EMPTY_DETAIL: DetailPayload = {
  reviewComments: [],
  structuredConversationComments: [],
  commitDates: [],
  conversationComments: '',
};

/**
 * Lazily fetches per-PR detail (review comments, conversation comments, commit dates)
 * for the currently-selected PR and patches it into the list via `updatePR`.
 *
 * Triggers whenever the PR identity (`owner/repo/number`) or its `updatedAt` changes,
 * so the right pane in two-pane mode updates correctly as the user arrow-keys.
 *
 * Pass `enabled=false` when the detail pane isn't visible (single-pane list mode)
 * to avoid fetching for selections the user can't see.
 *
 * Race guard: when a new fetch begins for a key, the prior in-flight controller is
 * aborted and its result is discarded — keeps `updatePR` patches in order even when
 * the user changes selection mid-fetch. The underlying `gh` subprocess can't be
 * cancelled, so an aborted fetch still completes; the abort only suppresses the
 * resulting `updatePR` patch.
 */
export function useFetchPRDetail(
  pr: PR | undefined,
  updatePR: UpdatePRFn,
  enabled: boolean = true,
): void {
  const owner = pr?.repo.owner;
  const repo = pr?.repo.repo;
  const number = pr?.number;
  const updatedAt = pr?.updatedAt;
  const detailLoaded = pr?.detailLoaded;

  useEffect(() => {
    if (!enabled) return;
    if (!pr) return;
    if (detailLoaded) return;
    const key = keyFor(pr);

    // Cache hit (same updatedAt) — patch synchronously, no GH call.
    const cached = getCached(key, pr.updatedAt);
    if (cached) {
      updatePR(pr.repo.owner, pr.repo.repo, pr.number, buildPatch(pr, cached));
      return;
    }

    const controller = startInflight(key);

    (async () => {
      try {
        const [reviewComments, structuredConversationComments, commitDates] = await Promise.all([
          getReviewComments(pr.repo, pr.number),
          getStructuredConversationComments(pr.repo, pr.number),
          getCommitDates(pr.repo, pr.number),
        ]);
        if (controller.signal.aborted) return;

        const conversationComments = structuredToConversationString(structuredConversationComments);
        const detail: DetailPayload = {
          reviewComments,
          structuredConversationComments,
          commitDates,
          conversationComments,
        };
        setCached(key, pr.updatedAt, detail);
        clearInflight(key, controller);
        updatePR(pr.repo.owner, pr.repo.repo, pr.number, buildPatch(pr, detail));
      } catch {
        // Fetch failed (network, gh CLI error, etc.). Drop the "Loading…" UI by
        // marking detailLoaded:true with empty arrays — the user sees the
        // preliminary score with no comments, not a perpetual spinner. A future
        // refresh will retry.
        clearInflight(key, controller);
        if (controller.signal.aborted) return;
        updatePR(pr.repo.owner, pr.repo.repo, pr.number, buildPatch(pr, EMPTY_DETAIL));
      }
    })();

    return () => {
      // Component unmounted or deps changed before fetch finished.
      // Abort so the patch is dropped if we're still the active controller.
      controller.abort();
      clearInflight(key, controller);
    };
    // Identity + staleness only — do NOT include the full `pr` object, otherwise
    // unrelated patches (e.g. label toggle) would restart this fetch.
  }, [enabled, owner, repo, number, updatedAt, detailLoaded, updatePR]); // eslint-disable-line react-hooks/exhaustive-deps
}
