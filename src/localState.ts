import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { LocalPRState, PR, RepoConfig } from './types.js';
import { CODING_DIR, REPOS } from './types.js';

const execFileAsync = promisify(execFile);

const EMPTY_STATE: LocalPRState = {
  marker: '-',
  branchExists: false,
  worktreePath: null,
  dirty: false,
  ahead: 0,
  behind: 0,
};

export function repoPath(repo: RepoConfig): string {
  if (repo.localPath) return repo.localPath;

  const ownerQualifiedPath = path.join(CODING_DIR, repo.owner, repo.repo);
  const legacyPath = path.join(CODING_DIR, repo.repo);
  const hasDuplicateName = REPOS.filter(r => r.repo === repo.repo).length > 1;

  if (existsSync(ownerQualifiedPath) || hasDuplicateName) {
    return ownerQualifiedPath;
  }
  return legacyPath;
}

async function git(repoDir: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', repoDir, ...args], {
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
  return result.stdout.trim();
}

async function hasBranch(repoDir: string, branch: string): Promise<boolean> {
  try {
    await git(repoDir, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

export function parseWorktreeForBranch(output: string, branch: string): string | null {
  const normalized = output.replace(/\r\n/g, '\n');
  const records = normalized.split('\n\n').filter(Boolean);
  for (const record of records) {
    const lines = record.split('\n').map(line => line.trim());
    const worktree = lines.find(line => line.startsWith('worktree '))?.slice('worktree '.length);
    const branchRef = lines.find(line => line.startsWith('branch '))?.slice('branch '.length);
    if (worktree && branchRef === `refs/heads/${branch}`) {
      return worktree;
    }
  }
  return null;
}

async function findWorktree(repoDir: string, branch: string): Promise<string | null> {
  try {
    const output = await git(repoDir, ['worktree', 'list', '--porcelain']);
    return parseWorktreeForBranch(output, branch);
  } catch {
    return null;
  }
}

async function isDirty(worktreePath: string): Promise<boolean> {
  try {
    const output = await git(worktreePath, ['status', '--porcelain']);
    return output.length > 0;
  } catch {
    return false;
  }
}

async function syncCounts(repoDir: string, branch: string): Promise<{ ahead: number; behind: number }> {
  try {
    const localRef = `refs/heads/${branch}`;
    const upstreamRef = `refs/remotes/origin/${branch}`;
    await git(repoDir, ['show-ref', '--verify', '--quiet', upstreamRef]);
    const output = await git(repoDir, ['rev-list', '--left-right', '--count', `${localRef}...${upstreamRef}`]);
    const [aheadRaw, behindRaw] = output.split(/\s+/);
    return {
      ahead: Number(aheadRaw ?? 0),
      behind: Number(behindRaw ?? 0),
    };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

export function markerFor(state: Omit<LocalPRState, 'marker'>): LocalPRState['marker'] {
  if (state.worktreePath) return state.dirty ? 'W*' : 'W';
  if (!state.branchExists) return '-';
  if (state.ahead > 0 && state.behind > 0) return 'L↕';
  if (state.ahead > 0) return 'L↑';
  if (state.behind > 0) return 'L↓';
  return 'L';
}

export async function getLocalPRState(pr: Pick<PR, 'headRefName' | 'repo'>): Promise<LocalPRState> {
  const dir = repoPath(pr.repo);
  if (!existsSync(dir)) return { ...EMPTY_STATE };

  const branchExists = await hasBranch(dir, pr.headRefName);
  const worktreePath = branchExists ? await findWorktree(dir, pr.headRefName) : null;
  const dirty = worktreePath ? await isDirty(worktreePath) : false;
  const { ahead, behind } = branchExists ? await syncCounts(dir, pr.headRefName) : { ahead: 0, behind: 0 };
  const state = { branchExists, worktreePath, dirty, ahead, behind };

  return {
    ...state,
    marker: markerFor(state),
  };
}
