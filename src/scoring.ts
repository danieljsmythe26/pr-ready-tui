import type { PR, ScoreBreakdown, CICheck } from './types.js';

export function scoreCi(checks: CICheck[]): number {
  if (checks.length === 0) return 15; // No CI = unknown
  let sum = 0;
  for (const c of checks) {
    if (c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL' || c.conclusion === 'SKIPPED') {
      sum += 1;
    } else if (c.conclusion === 'FAILURE' || c.conclusion === 'CANCELLED' || c.conclusion === 'TIMED_OUT' || c.conclusion === 'ACTION_REQUIRED') {
      sum += 0;
    } else {
      sum += 0.5; // Pending
    }
  }
  return Math.round(30 * sum / checks.length);
}

export function scoreReviews(reviewDecision: string): number {
  switch (reviewDecision) {
    case 'APPROVED': return 30;
    case 'CHANGES_REQUESTED': return 0;
    case 'REVIEW_REQUIRED': return 10;
    default: return 10; // No reviews yet
  }
}

export function scoreConflicts(mergeable: string): number {
  switch (mergeable) {
    case 'MERGEABLE': return 20;
    case 'CONFLICTING': return 0;
    default: return 10; // UNKNOWN
  }
}

export function scoreStaleness(updatedAt: string): number {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 1) return 20;
  if (ageDays < 3) return 15;
  if (ageDays < 7) return 10;
  if (ageDays < 14) return 5;
  return 0;
}

export function computeScore(pr: Omit<PR, 'score' | 'scoreBreakdown'>): ScoreBreakdown {
  const ci = scoreCi(pr.statusCheckRollup);
  const reviews = scoreReviews(pr.reviewDecision);
  const conflicts = scoreConflicts(pr.mergeable);
  const staleness = scoreStaleness(pr.updatedAt);
  return { ci, reviews, conflicts, staleness, total: ci + reviews + conflicts + staleness };
}
