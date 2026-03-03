import type { PR, ScoreBreakdown, CICheck, ConversationComment } from './types.js';

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

const REVIEW_BOTS = ['claude[bot]', 'coderabbitai[bot]', 'copilot-pull-request-reviewer', 'github-actions', 'github-actions[bot]'];

export function scoreReviews(
  reviewDecision: string,
  botComments: ConversationComment[] = [],
  commitDates: { author: string; date: string }[] = [],
  prAuthor: string = '',
): { score: number; penalty: number } {
  let base: number;
  switch (reviewDecision) {
    case 'APPROVED': base = 30; break;
    case 'CHANGES_REQUESTED': base = 0; break;
    case 'REVIEW_REQUIRED': base = 10; break;
    default: base = 10;
  }

  // Filter to actionable bot review comments (not by PR author)
  const actionable = botComments.filter(c =>
    REVIEW_BOTS.includes(c.author.toLowerCase()) && c.author.toLowerCase() !== prAuthor.toLowerCase()
  );

  if (actionable.length === 0) return { score: base, penalty: 0 };

  // Count addressed: commit by PR author exists after comment + 2min guard
  const authorCommitDates = commitDates
    .filter(c => c.author.toLowerCase() === prAuthor.toLowerCase())
    .map(c => new Date(c.date).getTime());

  let addressed = 0;
  for (const comment of actionable) {
    const commentTime = new Date(comment.createdAt).getTime() + 120_000; // +2min
    if (authorCommitDates.some(d => d > commentTime)) {
      addressed++;
    }
  }

  const coverage = addressed / actionable.length;
  const coverageScore = Math.round(30 * coverage);
  return { score: coverageScore, penalty: coverageScore - base };
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
  const { score: reviews, penalty: reviewPenalty } = scoreReviews(
    pr.reviewDecision,
    pr.structuredConversationComments,
    pr.commitDates,
    pr.author,
  );
  const conflicts = scoreConflicts(pr.mergeable);
  const staleness = scoreStaleness(pr.updatedAt);
  return { ci, reviews, reviewPenalty, conflicts, staleness, total: ci + reviews + conflicts + staleness };
}
