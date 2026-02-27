import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeScore, scoreCi, scoreReviews, scoreConflicts, scoreStaleness } from '../scoring.js';
import type { PR, CICheck, RepoConfig } from '../types.js';

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
      conflicts: 0,
      staleness: 20,
      total: 50,
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
  it('scores approvals and changes requested', () => {
    expect(scoreReviews('APPROVED')).toBe(30);
    expect(scoreReviews('CHANGES_REQUESTED')).toBe(0);
  });

  it('scores review required and defaults', () => {
    expect(scoreReviews('REVIEW_REQUIRED')).toBe(10);
    expect(scoreReviews('')).toBe(10);
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
