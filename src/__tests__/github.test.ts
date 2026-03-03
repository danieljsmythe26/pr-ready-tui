import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RepoConfig } from '../types.js';

type ExecFileCallback = (error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void;

const childProcessMock = vi.hoisted(() => {
  const fn = vi.fn();
  // Add the custom promisify symbol so promisify(execFile) returns { stdout, stderr }
  // like the real Node.js API, instead of resolving with just the first callback arg.
  const customSymbol = Symbol.for('nodejs.util.promisify.custom');
  (fn as unknown as Record<symbol, unknown>)[customSymbol] = (...args: unknown[]) =>
    new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      fn(...args, (err: Error | null, stdout: string, stderr: string) => {
        if (err) reject(err);
        else resolve({ stdout, stderr });
      });
    });
  return { execFile: fn };
});

vi.mock('node:child_process', () => childProcessMock);

let listOpenPRs: typeof import('../github.js').listOpenPRs;
let listAllOpenPRs: typeof import('../github.js').listAllOpenPRs;
let toggleLabel: typeof import('../github.js').toggleLabel;
let getStructuredConversationComments: typeof import('../github.js').getStructuredConversationComments;
let getCommitDates: typeof import('../github.js').getCommitDates;
let execFileMock: typeof childProcessMock.execFile;

describe('github', () => {
  beforeEach(async () => {
    execFileMock = childProcessMock.execFile;
    execFileMock.mockReset();
    vi.resetModules();
    ({ listOpenPRs, listAllOpenPRs, toggleLabel, getStructuredConversationComments, getCommitDates } = await import('../github.js'));
  });

  it('maps raw GH response to PR fields', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };
    const raw = [{
      number: 42,
      title: 'Add feature',
      state: 'OPEN',
      headRefName: 'feature/thing',
      baseRefName: 'main',
      mergeable: 'MERGEABLE',
      additions: 12,
      deletions: 3,
      changedFiles: 2,
      labels: [{ name: 'feature' }],
      author: { login: 'alice' },
      url: 'https://example.com/pr/42',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-20T00:00:00Z',
      isDraft: false,
      reviewDecision: 'APPROVED',
      statusCheckRollup: [
        { name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' },
      ],
    }];

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, JSON.stringify(raw), '');
    });

    const prs = await listOpenPRs(repo);
    expect(execFileMock).toHaveBeenCalledOnce();
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({
      number: 42,
      title: 'Add feature',
      labels: ['feature'],
      author: 'alice',
      reviewDecision: 'APPROVED',
      statusCheckRollup: [{ name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' }],
      repo,
    });
  });

  it('handles missing fields gracefully', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };
    const raw = [{
      number: 1,
      title: 'Missing fields',
      state: 'OPEN',
      headRefName: 'feature/missing',
      baseRefName: 'main',
      mergeable: 'UNKNOWN',
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      labels: [],
      author: { login: 'bob' },
      url: 'https://example.com/pr/1',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-20T00:00:00Z',
      isDraft: false,
      reviewDecision: null,
      statusCheckRollup: null,
    }];

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, JSON.stringify(raw), '');
    });

    const prs = await listOpenPRs(repo);
    expect(prs[0]?.reviewDecision).toBe('');
    expect(prs[0]?.statusCheckRollup).toEqual([]);
  });

  it('deduplicates checks by name, keeping the latest', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };
    const raw = [{
      number: 10,
      title: 'Dedup test',
      state: 'OPEN',
      headRefName: 'fix/dedup',
      baseRefName: 'main',
      mergeable: 'MERGEABLE',
      additions: 1,
      deletions: 0,
      changedFiles: 1,
      labels: [],
      author: { login: 'alice' },
      url: 'https://example.com/pr/10',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-20T00:00:00Z',
      isDraft: false,
      reviewDecision: 'APPROVED',
      statusCheckRollup: [
        { name: 'ci', conclusion: 'FAILURE', status: 'COMPLETED' },
        { name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' },
        { name: 'lint', conclusion: 'SUCCESS', status: 'COMPLETED' },
      ],
    }];

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, JSON.stringify(raw), '');
    });

    const prs = await listOpenPRs(repo);
    expect(prs[0]?.statusCheckRollup).toEqual([
      { name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' },
      { name: 'lint', conclusion: 'SUCCESS', status: 'COMPLETED' },
    ]);
  });

  it('maps StatusContext entries (with __typename)', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };
    const raw = [{
      number: 11,
      title: 'StatusContext test',
      state: 'OPEN',
      headRefName: 'fix/status',
      baseRefName: 'main',
      mergeable: 'MERGEABLE',
      additions: 1,
      deletions: 0,
      changedFiles: 1,
      labels: [],
      author: { login: 'alice' },
      url: 'https://example.com/pr/11',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-20T00:00:00Z',
      isDraft: false,
      reviewDecision: '',
      statusCheckRollup: [
        { __typename: 'StatusContext', context: 'deploy/vercel', state: 'success' },
        { __typename: 'StatusContext', context: 'security/snyk', state: 'error' },
        { __typename: 'StatusContext', context: 'CodeRabbit', state: 'pending' },
      ],
    }];

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, JSON.stringify(raw), '');
    });

    const prs = await listOpenPRs(repo);
    expect(prs[0]?.statusCheckRollup).toEqual([
      { name: 'deploy/vercel', conclusion: 'SUCCESS', status: 'SUCCESS' },
      { name: 'security/snyk', conclusion: 'FAILURE', status: 'ERROR' },
      { name: 'CodeRabbit', conclusion: null, status: 'PENDING' },
    ]);
  });

  it('detects StatusContext without __typename (fallback on field presence)', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };
    const raw = [{
      number: 12,
      title: 'Fallback detection',
      state: 'OPEN',
      headRefName: 'fix/fallback',
      baseRefName: 'main',
      mergeable: 'MERGEABLE',
      additions: 1,
      deletions: 0,
      changedFiles: 1,
      labels: [],
      author: { login: 'alice' },
      url: 'https://example.com/pr/12',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-20T00:00:00Z',
      isDraft: false,
      reviewDecision: '',
      statusCheckRollup: [
        { context: 'deploy/netlify', state: 'success' },
      ],
    }];

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, JSON.stringify(raw), '');
    });

    const prs = await listOpenPRs(repo);
    expect(prs[0]?.statusCheckRollup).toEqual([
      { name: 'deploy/netlify', conclusion: 'SUCCESS', status: 'SUCCESS' },
    ]);
  });

  it('handles mixed CheckRun and StatusContext in the same rollup', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };
    const raw = [{
      number: 13,
      title: 'Mixed types',
      state: 'OPEN',
      headRefName: 'fix/mixed',
      baseRefName: 'main',
      mergeable: 'MERGEABLE',
      additions: 5,
      deletions: 2,
      changedFiles: 3,
      labels: [],
      author: { login: 'bob' },
      url: 'https://example.com/pr/13',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-20T00:00:00Z',
      isDraft: false,
      reviewDecision: '',
      statusCheckRollup: [
        { name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' },
        { __typename: 'StatusContext', context: 'security/snyk', state: 'error' },
        { name: 'deploy', conclusion: null, status: 'IN_PROGRESS' },
      ],
    }];

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, JSON.stringify(raw), '');
    });

    const prs = await listOpenPRs(repo);
    expect(prs[0]?.statusCheckRollup).toEqual([
      { name: 'ci', conclusion: 'SUCCESS', status: 'COMPLETED' },
      { name: 'security/snyk', conclusion: 'FAILURE', status: 'ERROR' },
      { name: 'deploy', conclusion: null, status: 'IN_PROGRESS' },
    ]);
  });

  it('aggregates multiple repos and captures errors', async () => {
    const repoA: RepoConfig = { owner: 'acme', repo: 'widgets' };
    const repoB: RepoConfig = { owner: 'acme', repo: 'gadgets' };
    const raw = [{
      number: 5,
      title: 'Ok',
      state: 'OPEN',
      headRefName: 'feature/ok',
      baseRefName: 'main',
      mergeable: 'MERGEABLE',
      additions: 1,
      deletions: 1,
      changedFiles: 1,
      labels: [],
      author: { login: 'carol' },
      url: 'https://example.com/pr/5',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-20T00:00:00Z',
      isDraft: false,
      reviewDecision: 'REVIEW_REQUIRED',
      statusCheckRollup: [],
    }];

    execFileMock
      .mockImplementationOnce((...callArgs: unknown[]) => {
        const callback = callArgs.at(-1) as ExecFileCallback;
        callback(null, JSON.stringify(raw), '');
      })
      .mockImplementationOnce((...callArgs: unknown[]) => {
        const callback = callArgs.at(-1) as ExecFileCallback;
        callback(new Error('boom'), '', '');
      });

    const result = await listAllOpenPRs([repoA, repoB]);
    expect(result.prs).toHaveLength(1);
    expect(result.errors).toEqual(['gadgets: boom']);
  });

  it('toggleLabel adds label when not present', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, '', '');
    });

    const result = await toggleLabel(repo, 42, 'review', ['bug']);
    expect(result).toEqual({ action: 'added' });
    expect(execFileMock).toHaveBeenCalledWith(
      'gh',
      ['pr', 'edit', '42', '--repo', 'acme/widgets', '--add-label', 'review'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('toggleLabel removes label when already present', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, '', '');
    });

    const result = await toggleLabel(repo, 42, 'review', ['bug', 'review']);
    expect(result).toEqual({ action: 'removed' });
    expect(execFileMock).toHaveBeenCalledWith(
      'gh',
      ['pr', 'edit', '42', '--repo', 'acme/widgets', '--remove-label', 'review'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('getStructuredConversationComments returns parsed comments', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };
    const apiResponse = [
      { user: { login: 'claude[bot]' }, created_at: '2026-02-20T10:00:00Z', body: 'Fix this' },
      { user: { login: 'alice' }, created_at: '2026-02-20T10:05:00Z', body: 'Done' },
    ];

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, JSON.stringify(apiResponse), '');
    });

    const comments = await getStructuredConversationComments(repo, 42);
    expect(comments).toEqual([
      { author: 'claude[bot]', createdAt: '2026-02-20T10:00:00Z', body: 'Fix this' },
      { author: 'alice', createdAt: '2026-02-20T10:05:00Z', body: 'Done' },
    ]);
  });

  it('getStructuredConversationComments returns empty array on error', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(new Error('API error'), '', '');
    });

    const comments = await getStructuredConversationComments(repo, 42);
    expect(comments).toEqual([]);
  });

  it('getCommitDates returns parsed commit dates', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };
    const apiResponse = [
      { author: { login: 'alice' }, commit: { author: { date: '2026-02-20T10:10:00Z' } } },
      { author: null, commit: { author: { date: '2026-02-20T10:15:00Z' } } },
    ];

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(null, JSON.stringify(apiResponse), '');
    });

    const commits = await getCommitDates(repo, 42);
    expect(commits).toEqual([
      { author: 'alice', date: '2026-02-20T10:10:00Z' },
      { author: '', date: '2026-02-20T10:15:00Z' },
    ]);
  });

  it('getCommitDates returns empty array on error', async () => {
    const repo: RepoConfig = { owner: 'acme', repo: 'widgets' };

    execFileMock.mockImplementationOnce((...callArgs: unknown[]) => {
      const callback = callArgs.at(-1) as ExecFileCallback;
      callback(new Error('API error'), '', '');
    });

    const commits = await getCommitDates(repo, 42);
    expect(commits).toEqual([]);
  });
});
