import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocalPRState } from '../types.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('localState helpers', () => {
  it('parses worktree porcelain output with CRLF line endings', async () => {
    const { parseWorktreeForBranch } = await import('../localState.js');
    const output = [
      'worktree /repo/main\r\n',
      'HEAD abc123\r\n',
      'branch refs/heads/main\r\n',
      '\r\n',
      'worktree /repo/feature\r\n',
      'HEAD def456\r\n',
      'branch refs/heads/feature/test\r\n',
    ].join('');

    expect(parseWorktreeForBranch(output, 'feature/test')).toBe('/repo/feature');
  });

  it('maps branch and worktree state to compact markers', async () => {
    const { markerFor } = await import('../localState.js');
    const base: Omit<LocalPRState, 'marker'> = {
      branchExists: true,
      worktreePath: null,
      dirty: false,
      ahead: 0,
      behind: 0,
    };

    expect(markerFor({ ...base, branchExists: false })).toBe('-');
    expect(markerFor(base)).toBe('L');
    expect(markerFor({ ...base, worktreePath: '/repo/worktree' })).toBe('W');
    expect(markerFor({ ...base, worktreePath: '/repo/worktree', dirty: true })).toBe('W*');
    expect(markerFor({ ...base, ahead: 1 })).toBe('L↑');
    expect(markerFor({ ...base, behind: 1 })).toBe('L↓');
    expect(markerFor({ ...base, ahead: 1, behind: 1 })).toBe('L↕');
  });

  it('uses owner-qualified fallback paths when repo names are duplicated', async () => {
    vi.stubEnv('PRT_REPOS_DIR', '/tmp/coding');
    vi.stubEnv('PRT_REPOS', 'org-a/app,org-b/app');

    const { repoPath } = await import('../localState.js');

    expect(repoPath({ owner: 'org-a', repo: 'app' })).toBe('/tmp/coding/org-a/app');
    expect(repoPath({ owner: 'org-b', repo: 'app' })).toBe('/tmp/coding/org-b/app');
  });
});
