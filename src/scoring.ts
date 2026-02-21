import type { PR, ScoreBreakdown, CICheck } from './types.js';

function scoreCi(checks: CICheck[]): number {
  if (checks.length === 0) return 15; // No CI = unknown
  const allPassed = checks.every(c => c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL' || c.conclusion === 'SKIPPED');
  if (allPassed) return 30;
  const anyFailed = checks.some(c => c.conclusion === 'FAILURE' || c.conclusion === 'CANCELLED' || c.conclusion === 'TIMED_OUT' || c.conclusion === 'ACTION_REQUIRED');
  if (anyFailed) return 0;
  return 15; // Pending
}

function scoreReviews(reviewDecision: string): number {
  switch (reviewDecision) {
    case 'APPROVED': return 30;
    case 'CHANGES_REQUESTED': return 0;
    case 'REVIEW_REQUIRED': return 10;
    default: return 10; // No reviews yet
  }
}

function scoreConflicts(mergeable: string): number {
  switch (mergeable) {
    case 'MERGEABLE': return 20;
    case 'CONFLICTING': return 0;
    default: return 10; // UNKNOWN
  }
}

function scoreStaleness(updatedAt: string): number {
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
