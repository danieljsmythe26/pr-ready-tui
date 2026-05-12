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

type UpdatePRFn = (repoName: string, number: number, patch: Partial<PR>) => void;

function buildPatch(pr: PR, detail: DetailPayload): Partial<PR> {
  const sb = computeScore({ ...pr, ...detail });
  return {
    ...detail,
    detailLoaded: true,
    score: sb.total,
    scoreBreakdown: sb,
  };
}

/**
 * Lazily fetches per-PR detail (review comments, conversation comments, commit dates)
 * for the currently-selected PR and patches it into the list via `updatePR`.
 *
 * Triggers whenever the PR identity (`owner/repo/number`) or its `updatedAt` changes,
 * so the right pane in two-pane mode updates correctly as the user arrow-keys.
 *
 * Race guard: when a new fetch begins for a key, the prior in-flight controller is
 * aborted and its result is discarded — keeps `updatePR` patches in order even when
 * the user changes selection mid-fetch.
 */
export function useFetchPRDetail(pr: PR | undefined, updatePR: UpdatePRFn): void {
  useEffect(() => {
    if (!pr) return;
    const key = keyFor(pr);

    // Already loaded with matching updatedAt — nothing to do.
    if (pr.detailLoaded) return;

    // Cache hit (same updatedAt) — patch synchronously, no GH call.
    const cached = getCached(key, pr.updatedAt);
    if (cached) {
      updatePR(pr.repo.repo, pr.number, buildPatch(pr, cached));
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
        updatePR(pr.repo.repo, pr.number, buildPatch(pr, detail));
      } catch {
        clearInflight(key, controller);
      }
    })();

    return () => {
      // Component unmounted or deps changed before fetch finished.
      // If we're still the active controller, abort so the patch is dropped.
      controller.abort();
      clearInflight(key, controller);
    };
  }, [pr?.repo.owner, pr?.repo.repo, pr?.number, pr?.updatedAt, pr?.detailLoaded, updatePR, pr]);
}
