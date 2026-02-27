export interface RepoConfig {
  owner: string;
  repo: string;
  localPath?: string;
}

import { homedir } from 'node:os';

export const CODING_DIR = process.env.PRT_REPOS_DIR || `${homedir()}/Documents/coding`;

export const REPOS: RepoConfig[] = [
  { owner: 'danieljsmythe26', repo: 'ai-estimates-app' },
  { owner: 'danieljsmythe26', repo: 'design-build-automation' },
  { owner: 'danieljsmythe26', repo: 'ashton-paul' },
];

export interface PR {
  number: number;
  title: string;
  state: string;
  headRefName: string;
  baseRefName: string;
  mergeable: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: string[];
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  reviewDecision: string;
  statusCheckRollup: CICheck[];
  // Added by our pipeline
  repo: RepoConfig;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reviewComments: ReviewComment[];
  conversationComments: string;
  reviewVerdict: string | null;
}

export interface CICheck {
  name: string;
  conclusion: string | null;
  status: string;
}

export interface ReviewComment {
  path: string;
  line: number | null;
  body: string;
  author: string;
  createdAt: string;
}

export interface ScoreBreakdown {
  ci: number;
  reviews: number;
  conflicts: number;
  staleness: number;
  total: number;
}

export type View = 'list' | 'detail' | 'agent-picker' | 'merge-confirm' | 'help';

export type AgentAction = 'review' | 'fix' | 'fix-types';

export interface Agent {
  id: string;
  name: string;
  command: (repo: RepoConfig, pr: PR, action: AgentAction) => string;
}

/** Escape a string for safe interpolation inside a double-quoted shell argument. */
function escapeForDoubleQuotes(s: string): string {
  return s.replace(/[$`\\"!]/g, '\\$&');
}

export const AGENTS: Agent[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    command: (repo, pr, action) => {
      const owner = escapeForDoubleQuotes(repo.owner);
      const repoName = escapeForDoubleQuotes(repo.repo);
      const branch = escapeForDoubleQuotes(pr.headRefName);
      if (action === 'review') {
        return `unset CLAUDECODE && claude -p "Run /pr-readiness ${pr.number} on ${owner}/${repoName}. Check out the PR branch ${branch} first."`;
      }
      if (action === 'fix') {
        return `unset CLAUDECODE && claude -p "Fix the issues found in PR #${pr.number} on ${owner}/${repoName}. Check out branch ${branch}, address review comments, commit and push."`;
      }
      return `unset CLAUDECODE && claude -p "Check out branch ${branch} in ${owner}/${repoName}, run npm run typecheck, and fix any TypeScript errors. Commit and push."`;

    },
  },
  {
    id: 'codex',
    name: 'Codex',
    command: (repo, pr, action) => {
      const owner = escapeForDoubleQuotes(repo.owner);
      const repoName = escapeForDoubleQuotes(repo.repo);
      const branch = escapeForDoubleQuotes(pr.headRefName);
      if (action === 'review') {
        return `codex -a full-auto "Review PR #${pr.number} on ${owner}/${repoName}. Run the pr-readiness checklist."`;
      }
      if (action === 'fix') {
        return `codex -a full-auto "Fix the issues in PR #${pr.number} on ${owner}/${repoName}. Check out ${branch}, fix review comments, commit and push."`;
      }
      return `codex -a full-auto "Check out ${branch} in ${owner}/${repoName}, run npm run typecheck, fix errors, commit and push."`;
    },
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    command: (repo, pr, action) => {
      const owner = escapeForDoubleQuotes(repo.owner);
      const repoName = escapeForDoubleQuotes(repo.repo);
      const branch = escapeForDoubleQuotes(pr.headRefName);
      if (action === 'review') {
        return `gh copilot suggest "Review PR #${pr.number} on ${owner}/${repoName}"`;
      }
      if (action === 'fix') {
        return `gh copilot suggest "Fix issues in PR #${pr.number} on ${owner}/${repoName}"`;
      }
      return `gh copilot suggest "Fix TypeScript errors on branch ${branch} in ${owner}/${repoName}"`;
    },
  },
  {
    id: 'amp',
    name: 'Amp',
    command: (repo, pr, action) => {
      const owner = escapeForDoubleQuotes(repo.owner);
      const repoName = escapeForDoubleQuotes(repo.repo);
      const branch = escapeForDoubleQuotes(pr.headRefName);
      if (action === 'review') {
        return `amp "Review PR #${pr.number} on ${owner}/${repoName}. Run the pr-readiness checklist."`;
      }
      if (action === 'fix') {
        return `amp "Fix the issues in PR #${pr.number} on ${owner}/${repoName}. Check out ${branch}, fix review comments, commit and push."`;
      }
      return `amp "Check out ${branch} in ${owner}/${repoName}, run npm run typecheck, fix errors, commit and push."`;
    },
  },
];

export const BOT_AUTHORS = ['dependabot', 'dependabot[bot]', 'snyk-bot', 'renovate', 'renovate[bot]', 'app/dependabot', 'app/snyk-bot', 'app/renovate'];

export function isBotAuthor(author: string): boolean {
  const lower = author.toLowerCase();
  return BOT_AUTHORS.some(b => lower === b || lower.includes('dependabot') || lower.includes('snyk') || lower.includes('renovate'));
}
