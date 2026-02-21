import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PR, CICheck, ReviewComment, RepoConfig } from './types.js';

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

async function gh<T>(args: string): Promise<T> {
  const { stdout } = await execFileAsync('gh', args.split(/\s+/), {
    maxBuffer: MAX_BUFFER,
  });
  return JSON.parse(stdout);
}

async function ghRaw(args: string): Promise<string> {
  const { stdout } = await execFileAsync('gh', args.split(/\s+/), {
    maxBuffer: MAX_BUFFER,
  });
  return stdout.trim();
}

interface RawPR {
  number: number;
  title: string;
  state: string;
  headRefName: string;
  baseRefName: string;
  mergeable: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: Array<{ name: string }>;
  author: { login: string };
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  reviewDecision: string;
  statusCheckRollup: Array<{ name: string; conclusion: string | null; status: string }>;
}

const PR_FIELDS = [
  'number', 'title', 'state', 'headRefName', 'baseRefName', 'mergeable',
  'additions', 'deletions', 'changedFiles', 'labels', 'author', 'url',
  'createdAt', 'updatedAt', 'isDraft', 'reviewDecision', 'statusCheckRollup',
].join(',');

export async function listOpenPRs(repo: RepoConfig): Promise<Omit<PR, 'score' | 'scoreBreakdown'>[]> {
  const raws = await gh<RawPR[]>(
    `pr list --repo ${repo.owner}/${repo.repo} --state open --json ${PR_FIELDS} --limit 50`
  );

  return raws.map(raw => ({
    number: raw.number,
    title: raw.title,
    state: raw.state,
    headRefName: raw.headRefName,
    baseRefName: raw.baseRefName,
    mergeable: raw.mergeable,
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    labels: raw.labels.map(l => l.name),
    author: raw.author.login,
    url: raw.url,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    isDraft: raw.isDraft,
    reviewDecision: raw.reviewDecision ?? '',
    statusCheckRollup: (raw.statusCheckRollup ?? []).map(c => ({
      name: c.name,
      conclusion: c.conclusion,
      status: c.status,
    })),
    repo,
  }));
}

export interface AllPRsResult {
  prs: Omit<PR, 'score' | 'scoreBreakdown'>[];
  errors: string[];
}

export async function listAllOpenPRs(repos: RepoConfig[]): Promise<AllPRsResult> {
  const results = await Promise.allSettled(repos.map(r => listOpenPRs(r)));
  const prs: Omit<PR, 'score' | 'scoreBreakdown'>[] = [];
  const errors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === 'fulfilled') {
      prs.push(...result.value);
    } else {
      errors.push(`${repos[i]!.repo}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  }
  if (prs.length === 0 && errors.length > 0) {
    throw new Error(`All repos failed: ${errors.join('; ')}`);
  }
  return { prs, errors };
}

export async function getReviewComments(repo: RepoConfig, prNumber: number): Promise<ReviewComment[]> {
  try {
    const comments = await gh<Array<{
      path: string;
      line: number | null;
      original_line: number | null;
      body: string;
      user: { login: string };
      created_at: string;
    }>>(`api repos/${repo.owner}/${repo.repo}/pulls/${prNumber}/comments`);

    return comments.map(c => ({
      path: c.path,
      line: c.line ?? c.original_line,
      body: c.body,
      author: c.user.login,
      createdAt: c.created_at,
    }));
  } catch {
    return [];
  }
}

export async function getConversationComments(repo: RepoConfig, prNumber: number): Promise<string> {
  try {
    return await ghRaw(`pr view ${prNumber} --repo ${repo.owner}/${repo.repo} --comments`);
  } catch {
    return '';
  }
}
