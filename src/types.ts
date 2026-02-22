export interface RepoConfig {
  owner: string;
  repo: string;
}

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

export type View = 'list' | 'detail' | 'agent-picker' | 'merge-confirm';

export type AgentAction = 'review' | 'fix' | 'fix-types';

export interface Agent {
  id: string;
  name: string;
  command: (repo: RepoConfig, pr: PR, action: AgentAction) => string;
}

export const AGENTS: Agent[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    command: (repo, pr, action) => {
      if (action === 'review') {
        return `claude -p "Run /pr-readiness ${pr.number} on ${repo.owner}/${repo.repo}. Check out the PR branch ${pr.headRefName} first."`;
      }
      if (action === 'fix') {
        return `claude -p "Fix the issues found in PR #${pr.number} on ${repo.owner}/${repo.repo}. Check out branch ${pr.headRefName}, address review comments, commit and push."`;
      }
      return `claude -p "Check out branch ${pr.headRefName} in ${repo.owner}/${repo.repo}, run npm run typecheck, and fix any TypeScript errors. Commit and push."`;
    },
  },
  {
    id: 'codex',
    name: 'Codex',
    command: (repo, pr, action) => {
      if (action === 'review') {
        return `codex -a full-auto "Review PR #${pr.number} on ${repo.owner}/${repo.repo}. Run the pr-readiness checklist."`;
      }
      if (action === 'fix') {
        return `codex -a full-auto "Fix the issues in PR #${pr.number} on ${repo.owner}/${repo.repo}. Check out ${pr.headRefName}, fix review comments, commit and push."`;
      }
      return `codex -a full-auto "Check out ${pr.headRefName} in ${repo.owner}/${repo.repo}, run npm run typecheck, fix errors, commit and push."`;
    },
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    command: (repo, pr, action) => {
      if (action === 'review') {
        return `gh copilot suggest "Review PR #${pr.number} on ${repo.owner}/${repo.repo}"`;
      }
      if (action === 'fix') {
        return `gh copilot suggest "Fix issues in PR #${pr.number} on ${repo.owner}/${repo.repo}"`;
      }
      return `gh copilot suggest "Fix TypeScript errors on branch ${pr.headRefName} in ${repo.owner}/${repo.repo}"`;
    },
  },
  {
    id: 'amp',
    name: 'Amp',
    command: (repo, pr, action) => {
      if (action === 'review') {
        return `amp "Review PR #${pr.number} on ${repo.owner}/${repo.repo}. Run the pr-readiness checklist."`;
      }
      if (action === 'fix') {
        return `amp "Fix the issues in PR #${pr.number} on ${repo.owner}/${repo.repo}. Check out ${pr.headRefName}, fix review comments, commit and push."`;
      }
      return `amp "Check out ${pr.headRefName} in ${repo.owner}/${repo.repo}, run npm run typecheck, fix errors, commit and push."`;
    },
  },
];

export const BOT_AUTHORS = ['dependabot', 'dependabot[bot]', 'snyk-bot', 'renovate', 'renovate[bot]', 'app/dependabot', 'app/snyk-bot', 'app/renovate'];

export function isBotAuthor(author: string): boolean {
  const lower = author.toLowerCase();
  return BOT_AUTHORS.some(b => lower === b || lower.includes('dependabot') || lower.includes('snyk') || lower.includes('renovate'));
}
