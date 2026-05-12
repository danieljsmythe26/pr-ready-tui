import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PR, CICheck, ReviewComment, ConversationComment, RepoConfig } from './types.js';

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 10 * 1024 * 1024; // 10MB
const GH_TIMEOUT = 30_000; // 30s
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // 1s, 3s backoff

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /unexpected EOF|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isTransientError(error)) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]!));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function gh<T>(args: string[]): Promise<T> {
  return withRetry(async () => {
    const result = await execFileAsync('gh', args, {
      maxBuffer: MAX_BUFFER,
      timeout: GH_TIMEOUT,
    });
    return JSON.parse(result.stdout);
  });
}

async function ghRaw(args: string[], opts: { retry?: boolean } = {}): Promise<string> {
  const run = async () => {
    const result = await execFileAsync('gh', args, {
      maxBuffer: MAX_BUFFER,
      timeout: GH_TIMEOUT,
    });
    return result.stdout.trim();
  };
  return opts.retry === false ? run() : withRetry(run);
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
  statusCheckRollup: Array<{
    __typename?: string;
    // CheckRun fields
    name?: string;
    conclusion?: string | null;
    status?: string;
    // StatusContext fields
    context?: string;
    state?: string;
  }>;
}

const PR_FIELDS = [
  'number', 'title', 'state', 'headRefName', 'baseRefName', 'mergeable',
  'additions', 'deletions', 'changedFiles', 'labels', 'author', 'url',
  'createdAt', 'updatedAt', 'isDraft', 'reviewDecision', 'statusCheckRollup',
].join(',');

/** Deduplicate CI checks by name, keeping the latest (last) entry for each. */
function deduplicateChecks(checks: CICheck[]): CICheck[] {
  const byName = new Map<string, CICheck>();
  for (const check of checks) {
    byName.set(check.name, check);
  }
  return Array.from(byName.values());
}

export async function listOpenPRs(repo: RepoConfig): Promise<Omit<PR, 'score' | 'scoreBreakdown'>[]> {
  const raws = await gh<RawPR[]>([
    'pr', 'list',
    '--repo', `${repo.owner}/${repo.repo}`,
    '--state', 'open',
    '--json', PR_FIELDS,
    '--limit', '50',
  ]);

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
    statusCheckRollup: deduplicateChecks((raw.statusCheckRollup ?? []).map(c => {
      if (c.__typename === 'StatusContext' || (!c.name && c.context)) {
        // StatusContext: map context → name, state → conclusion
        const state = (c.state ?? '').toUpperCase();
        const conclusion = state === 'SUCCESS' ? 'SUCCESS'
          : state === 'ERROR' || state === 'FAILURE' ? 'FAILURE'
          : null; // PENDING, EXPECTED, or unknown → pending
        return { name: c.context ?? 'unknown', conclusion, status: state };
      }
      return { name: c.name ?? 'unknown', conclusion: c.conclusion ?? null, status: c.status ?? '' };
    })),
    repo,
    reviewComments: [],
    conversationComments: '',
    structuredConversationComments: [],
    commitDates: [],
    reviewVerdict: null,
    detailLoaded: false,
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
    }>>([
      'api', '--paginate', '--slurp', `repos/${repo.owner}/${repo.repo}/pulls/${prNumber}/comments`,
    ]);

    return comments.flat().map(c => ({
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

export async function toggleLabel(
  repo: RepoConfig,
  prNumber: number,
  label: string,
  currentLabels: string[],
): Promise<{ action: 'added' | 'removed' }> {
  const hasLabel = currentLabels.includes(label);
  const flag = hasLabel ? '--remove-label' : '--add-label';
  await ghRaw([
    'pr', 'edit', String(prNumber),
    '--repo', `${repo.owner}/${repo.repo}`,
    flag, label,
  ], { retry: false });
  return { action: hasLabel ? 'removed' : 'added' };
}

/**
 * Render structured conversation comments into the `\n---\n`-delimited text format
 * that `PRDetail` parses and `cli.ts` prints. Shared so both consumers stay in sync
 * after `getConversationComments` was removed (it duplicated the REST call that
 * `getStructuredConversationComments` already makes).
 */
export function structuredToConversationString(comments: ConversationComment[]): string {
  return comments.map(c => `${c.author} (${c.createdAt}):\n${c.body}\n---`).join('\n');
}

export async function getStructuredConversationComments(repo: RepoConfig, prNumber: number): Promise<ConversationComment[]> {
  try {
    const comments = await gh<Array<{
      user: { login: string };
      created_at: string;
      body: string;
    }>>([
      'api', '--paginate', '--slurp', `repos/${repo.owner}/${repo.repo}/issues/${prNumber}/comments`,
    ]);

    return comments.flat().map(c => ({
      author: c.user.login,
      createdAt: c.created_at,
      body: c.body,
    }));
  } catch {
    return [];
  }
}

export async function getCommitDates(repo: RepoConfig, prNumber: number): Promise<{ author: string; date: string }[]> {
  try {
    const commits = await gh<Array<{
      author: { login: string } | null;
      commit: { author: { date: string } };
    }>>([
      'api', '--paginate', '--slurp', `repos/${repo.owner}/${repo.repo}/pulls/${prNumber}/commits`,
    ]);

    return commits.flat().map(c => ({
      author: c.author?.login ?? '',
      date: c.commit.author.date,
    }));
  } catch {
    return [];
  }
}
