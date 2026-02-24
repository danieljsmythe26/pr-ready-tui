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
let execFileMock: typeof childProcessMock.execFile;

describe('github', () => {
  beforeEach(async () => {
    execFileMock = childProcessMock.execFile;
    execFileMock.mockReset();
    vi.resetModules();
    ({ listOpenPRs, listAllOpenPRs } = await import('../github.js'));
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
});
