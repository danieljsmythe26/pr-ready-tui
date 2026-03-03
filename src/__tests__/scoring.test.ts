import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeScore, scoreCi, scoreReviews, scoreConflicts, scoreStaleness } from '../scoring.js';
import type { PR, CICheck, ConversationComment, RepoConfig } from '../types.js';

const baseRepo: RepoConfig = { owner: 'acme', repo: 'widgets' };

const basePr = (overrides: Partial<Omit<PR, 'score' | 'scoreBreakdown'>> = {}): Omit<PR, 'score' | 'scoreBreakdown'> => ({
  number: 1,
  title: 'Test PR',
  state: 'OPEN',
  headRefName: 'feature/test',
  baseRefName: 'main',
  mergeable: 'MERGEABLE',
  additions: 10,
  deletions: 2,
  changedFiles: 3,
  labels: [],
  author: 'alice',
  url: 'https://example.com/pr/1',
  createdAt: new Date('2026-02-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-02-20T00:00:00Z').toISOString(),
  isDraft: false,
  reviewDecision: 'APPROVED',
  statusCheckRollup: [],
  repo: baseRepo,
  reviewComments: [],
  conversationComments: '',
  structuredConversationComments: [],
  commitDates: [],
  reviewVerdict: null,
  ...overrides,
});

const fixedNow = new Date('2026-02-21T00:00:00Z').getTime();

const setNow = (ms: number) => {
  vi.spyOn(Date, 'now').mockReturnValue(ms);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('computeScore', () => {
  it('scores 100 for passed CI, approved, mergeable, fresh', () => {
    setNow(fixedNow);
    const pr = basePr({
      statusCheckRollup: [{ name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' }],
      reviewDecision: 'APPROVED',
      mergeable: 'MERGEABLE',
      updatedAt: new Date(fixedNow - 2 * 60 * 60 * 1000).toISOString(),
    });

    const score = computeScore(pr);
    expect(score).toEqual({
      ci: 30,
      reviews: 30,
      reviewPenalty: 0,
      conflicts: 20,
      staleness: 20,
      total: 100,
    });
  });

  it('scores lowest for all-failed CI, changes requested, conflicting, stale', () => {
    setNow(fixedNow);
    const pr = basePr({
      statusCheckRollup: [{ name: 'ci', conclusion: 'FAILURE', status: 'COMPLETED' }],
      reviewDecision: 'CHANGES_REQUESTED',
      mergeable: 'CONFLICTING',
      updatedAt: new Date(fixedNow - 31 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const score = computeScore(pr);
    expect(score.total).toBe(0); // ci:0 + reviews:0 + conflicts:0 + staleness:0
  });

  it('handles mixed signals', () => {
    setNow(fixedNow);
    const pr = basePr({
      statusCheckRollup: [{ name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' }],
      reviewDecision: 'CHANGES_REQUESTED',
      mergeable: 'CONFLICTING',
      updatedAt: new Date(fixedNow - 6 * 60 * 60 * 1000).toISOString(),
    });

    const score = computeScore(pr);
    expect(score).toEqual({
      ci: 30,
      reviews: 0,
      reviewPenalty: 0,
      conflicts: 0,
      staleness: 20,
      total: 50,
    });
  });

  it('boosts review score via coverage when bot comments are addressed', () => {
    setNow(fixedNow);
    const pr = basePr({
      statusCheckRollup: [{ name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' }],
      reviewDecision: '', // no human review → base would be 10
      mergeable: 'MERGEABLE',
      updatedAt: new Date(fixedNow - 2 * 60 * 60 * 1000).toISOString(),
      structuredConversationComments: [
        { author: 'claude[bot]', createdAt: '2026-02-20T10:00:00Z', body: 'Fix this' },
        { author: 'coderabbitai[bot]', createdAt: '2026-02-20T10:05:00Z', body: 'Also this' },
      ],
      commitDates: [
        { author: 'alice', date: '2026-02-20T10:10:00Z' },
      ],
    });

    const score = computeScore(pr);
    // 2/2 addressed → coverage=100% → reviews=30, boosted from base 10
    expect(score).toEqual({
      ci: 30,
      reviews: 30,
      reviewPenalty: 20,
      conflicts: 20,
      staleness: 20,
      total: 100,
    });
  });
});

describe('scoreCi', () => {
  it('returns 15 when no checks are present', () => {
    expect(scoreCi([])).toBe(15);
  });

  it('returns 30 when all checks pass or are neutral/skipped', () => {
    const checks: CICheck[] = [
      { name: 'build', conclusion: 'SUCCESS', status: 'COMPLETED' },
      { name: 'lint', conclusion: 'NEUTRAL', status: 'COMPLETED' },
      { name: 'docs', conclusion: 'SKIPPED', status: 'COMPLETED' },
    ];
    expect(scoreCi(checks)).toBe(30);
  });

  it('returns proportional score when some checks fail', () => {
    const checks: CICheck[] = [
      { name: 'build', conclusion: 'SUCCESS', status: 'COMPLETED' },
      { name: 'lint', conclusion: 'FAILURE', status: 'COMPLETED' },
    ];
    expect(scoreCi(checks)).toBe(15); // 30 * (1/2)
  });

  it('returns proportional score when checks are pending', () => {
    const checks: CICheck[] = [
      { name: 'build', conclusion: null, status: 'IN_PROGRESS' },
    ];
    expect(scoreCi(checks)).toBe(15); // 30 * (0.5/1)
  });

  it('returns proportional score for mixed passed/failed/pending', () => {
    const checks: CICheck[] = [
      { name: 'build', conclusion: 'SUCCESS', status: 'COMPLETED' },
      { name: 'lint', conclusion: 'SUCCESS', status: 'COMPLETED' },
      { name: 'security', conclusion: 'FAILURE', status: 'COMPLETED' },
      { name: 'deploy', conclusion: null, status: 'IN_PROGRESS' },
    ];
    expect(scoreCi(checks)).toBe(19); // 30 * (1+1+0+0.5)/4 = 30 * 2.5/4
  });
});

describe('scoreReviews', () => {
  it('scores approvals and changes requested (no bot comments)', () => {
    expect(scoreReviews('APPROVED')).toEqual({ score: 30, penalty: 0 });
    expect(scoreReviews('CHANGES_REQUESTED')).toEqual({ score: 0, penalty: 0 });
  });

  it('scores review required and defaults (no bot comments)', () => {
    expect(scoreReviews('REVIEW_REQUIRED')).toEqual({ score: 10, penalty: 0 });
    expect(scoreReviews('')).toEqual({ score: 10, penalty: 0 });
  });

  it('returns unchanged score when no bot comments exist', () => {
    const result = scoreReviews('APPROVED', [], [], 'alice');
    expect(result).toEqual({ score: 30, penalty: 0 });
  });

  it('returns unchanged score when all bot comments are addressed', () => {
    const comments: ConversationComment[] = [
      { author: 'claude[bot]', createdAt: '2026-02-20T10:00:00Z', body: 'Fix this' },
      { author: 'coderabbitai[bot]', createdAt: '2026-02-20T10:05:00Z', body: 'Also fix that' },
    ];
    const commits = [
      { author: 'alice', date: '2026-02-20T10:10:00Z' }, // 10min after first, 5min after second
    ];
    const result = scoreReviews('APPROVED', comments, commits, 'alice');
    expect(result).toEqual({ score: 30, penalty: 0 });
  });

  it('applies proportional penalty for partial coverage (7/10)', () => {
    const comments: ConversationComment[] = Array.from({ length: 10 }, (_, i) => ({
      author: 'claude[bot]',
      createdAt: `2026-02-20T10:${String(i).padStart(2, '0')}:00Z`,
      body: `Comment ${i}`,
    }));
    // Commit addresses first 7 comments (after 10:06 + 2min = 10:08), but not last 3 (10:07, 10:08, 10:09)
    const commits = [
      { author: 'alice', date: '2026-02-20T10:08:30Z' },
    ];
    const result = scoreReviews('APPROVED', comments, commits, 'alice');
    // addressed: comments 0-6 (createdAt + 2min < 10:08:30) = 7
    // coverage = 7/10 = 0.7, capped = min(30, round(30*0.7)) = 21
    expect(result).toEqual({ score: 21, penalty: -9 });
  });

  it('applies max penalty when no comments are addressed', () => {
    const comments: ConversationComment[] = [
      { author: 'claude[bot]', createdAt: '2026-02-20T10:00:00Z', body: 'Fix this' },
    ];
    // No commits by PR author after the comment
    const result = scoreReviews('APPROVED', comments, [], 'alice');
    expect(result).toEqual({ score: 0, penalty: -30 });
  });

  it('excludes self-comments from count', () => {
    const comments: ConversationComment[] = [
      { author: 'claude[bot]', createdAt: '2026-02-20T10:00:00Z', body: 'Bot comment' },
      { author: 'alice', createdAt: '2026-02-20T10:01:00Z', body: 'Self comment' },
    ];
    // No commits — only bot comment counts, self-comment excluded
    const result = scoreReviews('APPROVED', comments, [], 'alice');
    // 1 actionable, 0 addressed → coverage=0, capped=0
    expect(result).toEqual({ score: 0, penalty: -30 });
  });

  it('respects the 2-minute guard', () => {
    const comments: ConversationComment[] = [
      { author: 'claude[bot]', createdAt: '2026-02-20T10:00:00Z', body: 'Fix this' },
    ];
    // Commit only 1 minute after comment — within 2-min guard, should NOT count
    const commits = [
      { author: 'alice', date: '2026-02-20T10:01:00Z' },
    ];
    const result = scoreReviews('APPROVED', comments, commits, 'alice');
    expect(result).toEqual({ score: 0, penalty: -30 });
  });

  it('ignores non-bot comments', () => {
    const comments: ConversationComment[] = [
      { author: 'human-reviewer', createdAt: '2026-02-20T10:00:00Z', body: 'Human comment' },
    ];
    const result = scoreReviews('APPROVED', comments, [], 'alice');
    // No actionable bot comments → unchanged
    expect(result).toEqual({ score: 30, penalty: 0 });
  });

  it('coverage can boost score above base when comments are addressed', () => {
    const comments: ConversationComment[] = [
      { author: 'claude[bot]', createdAt: '2026-02-20T10:00:00Z', body: 'Fix this' },
      { author: 'coderabbitai[bot]', createdAt: '2026-02-20T10:05:00Z', body: 'Also fix that' },
    ];
    const commits = [
      { author: 'alice', date: '2026-02-20T10:10:00Z' },
    ];
    // REVIEW_REQUIRED base=10, but 100% coverage → score=30 (boosted above base)
    const result = scoreReviews('REVIEW_REQUIRED', comments, commits, 'alice');
    expect(result).toEqual({ score: 30, penalty: 20 });
  });

  it('partial coverage with low base gives proportional score', () => {
    const comments: ConversationComment[] = [
      { author: 'claude[bot]', createdAt: '2026-02-20T10:00:00Z', body: 'Comment 1' },
      { author: 'claude[bot]', createdAt: '2026-02-20T10:05:00Z', body: 'Comment 2' },
      { author: 'claude[bot]', createdAt: '2026-02-20T10:10:00Z', body: 'Comment 3' },
    ];
    // Only addresses first 2 comments
    const commits = [
      { author: 'alice', date: '2026-02-20T10:08:00Z' },
    ];
    // 2/3 addressed → coverage=0.67 → round(30*0.67)=20, base was 10
    const result = scoreReviews('REVIEW_REQUIRED', comments, commits, 'alice');
    expect(result).toEqual({ score: 20, penalty: 10 });
  });
});

describe('scoreConflicts', () => {
  it('scores mergeable vs conflicting', () => {
    expect(scoreConflicts('MERGEABLE')).toBe(20);
    expect(scoreConflicts('CONFLICTING')).toBe(0);
  });

  it('defaults for unknown', () => {
    expect(scoreConflicts('UNKNOWN')).toBe(10);
  });
});

describe('scoreStaleness', () => {
  it('scores staleness boundaries', () => {
    setNow(fixedNow);
    const dayMs = 24 * 60 * 60 * 1000;

    expect(scoreStaleness(new Date(fixedNow - 0.5 * dayMs).toISOString())).toBe(20);
    expect(scoreStaleness(new Date(fixedNow - 1 * dayMs).toISOString())).toBe(15);
    expect(scoreStaleness(new Date(fixedNow - 3 * dayMs).toISOString())).toBe(10);
    expect(scoreStaleness(new Date(fixedNow - 7 * dayMs).toISOString())).toBe(5);
    expect(scoreStaleness(new Date(fixedNow - 14 * dayMs).toISOString())).toBe(0);
  });
});
