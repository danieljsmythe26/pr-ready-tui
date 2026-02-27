#!/usr/bin/env node
/**
 * CLI mode for pr-ready — quick PR readiness check from the terminal.
 *
 * Usage:
 *   pr-ready 289                          # Check specific PR (auto-detects repo)
 *   pr-ready 289 --repo owner/repo        # Check PR in specific repo
 *   pr-ready                              # List all open PRs with scores
 *   pr-ready --json                       # JSON output (for AI agents)
 *   pr-ready --tui                        # Launch full TUI mode
 */

import { listAllOpenPRs, getReviewComments, getConversationComments } from './github.js';
import { computeScore } from './scoring.js';
import type { PR, RepoConfig, ScoreBreakdown, ReviewComment } from './types.js';
import { REPOS } from './types.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

function colorScore(score: number): string {
  if (score >= 80) return `${GREEN}${score}${RESET}`;
  if (score >= 50) return `${YELLOW}${score}${RESET}`;
  return `${RED}${score}${RESET}`;
}

function checkIcon(conclusion: string | null): string {
  if (!conclusion) return `${YELLOW}⏳${RESET}`;
  switch (conclusion.toUpperCase()) {
    case 'SUCCESS': case 'NEUTRAL': case 'SKIPPED': return `${GREEN}✅${RESET}`;
    case 'FAILURE': case 'CANCELLED': case 'TIMED_OUT': case 'ACTION_REQUIRED': return `${RED}❌${RESET}`;
    default: return `${YELLOW}⚠️${RESET}`;
  }
}

function mergeableIcon(mergeable: string): string {
  switch (mergeable) {
    case 'MERGEABLE': return `${GREEN}✅ Mergeable${RESET}`;
    case 'CONFLICTING': return `${RED}❌ Conflicts${RESET}`;
    default: return `${YELLOW}⚠️ Unknown${RESET}`;
  }
}

function reviewIcon(decision: string): string {
  switch (decision) {
    case 'APPROVED': return `${GREEN}✅ Approved${RESET}`;
    case 'CHANGES_REQUESTED': return `${RED}❌ Changes requested${RESET}`;
    case 'REVIEW_REQUIRED': return `${YELLOW}⏳ Review required${RESET}`;
    default: return `${DIM}No reviews${RESET}`;
  }
}

function verdict(score: ScoreBreakdown): string {
  if (score.total >= 80) return `${GREEN}${BOLD}Ready to merge${RESET}`;
  if (score.total >= 50) return `${YELLOW}${BOLD}Ready with caveats${RESET}`;
  return `${RED}${BOLD}Not ready${RESET}`;
}

function parseArgs(argv: string[]): { prNumber: number | undefined; repo: RepoConfig | undefined; json: boolean; tui: boolean; help: boolean } {
  let prNumber: number | undefined;
  let repo: RepoConfig | undefined;
  let json = false;
  let tui = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--json') { json = true; continue; }
    if (arg === '--tui') { tui = true; continue; }
    if (arg === '--help' || arg === '-h') { help = true; continue; }
    if (arg === '--repo') {
      if (!argv[i + 1]) {
        console.error(`${RED}--repo requires a value (e.g. --repo owner/repo)${RESET}`);
        process.exit(1);
      }
      const parts = argv[++i]!.split('/');
      if (parts.length === 2) {
        repo = { owner: parts[0]!, repo: parts[1]! };
      } else {
        console.error(`${RED}Invalid --repo format: expected owner/repo${RESET}`);
        process.exit(1);
      }
      continue;
    }
    const num = parseInt(arg, 10);
    if (!isNaN(num)) prNumber = num;
  }

  return { prNumber, repo, json, tui, help };
}

function printHelp(): void {
  console.log(`
${BOLD}pr-ready${RESET} — PR readiness checker

${BOLD}Usage:${RESET}
  pr-ready ${DIM}[PR_NUMBER] [OPTIONS]${RESET}

${BOLD}Examples:${RESET}
  pr-ready                       List all open PRs with scores
  pr-ready 289                   Check specific PR (auto-detects repo)
  pr-ready 289 --repo o/r        Check PR in specific repo
  pr-ready --json                JSON output for AI agents
  pr-ready --tui                 Launch full TUI dashboard

${BOLD}Options:${RESET}
  --repo owner/repo    Target repository
  --json               Output as JSON
  --tui                Launch TUI mode
  -h, --help           Show this help
`);
}

async function printPRDetail(pr: PR, repo: RepoConfig, json: boolean): Promise<void> {
  const [reviewComments, conversationComments] = await Promise.all([
    getReviewComments(repo, pr.number),
    getConversationComments(repo, pr.number),
  ]);

  if (json) {
    console.log(JSON.stringify({
      ...pr,
      reviewComments,
      conversationComments,
      verdict: pr.score >= 80 ? 'ready' : pr.score >= 50 ? 'caveats' : 'not_ready',
    }, null, 2));
    return;
  }

  const sb = pr.scoreBreakdown;

  console.log('');
  console.log(`  ${BOLD}${pr.title}${RESET}`);
  console.log(`  ${DIM}#${pr.number} by ${pr.author} · ${repo.owner}/${repo.repo}${RESET}`);
  console.log(`  ${DIM}${pr.headRefName} → ${pr.baseRefName} · +${pr.additions} -${pr.deletions} (${pr.changedFiles} files)${RESET}`);
  console.log(`  ${'─'.repeat(60)}`);

  // Score bar
  console.log(`  ${BOLD}Score:${RESET} ${colorScore(sb.total)}/100  ${verdict(sb)}`);
  console.log(`  ${DIM}CI: ${sb.ci}/30 · Reviews: ${sb.reviews}/30 · Conflicts: ${sb.conflicts}/20 · Freshness: ${sb.staleness}/20${RESET}`);
  console.log('');

  // Merge status
  console.log(`  ${mergeableIcon(pr.mergeable)}     ${reviewIcon(pr.reviewDecision)}`);
  console.log('');

  // CI checks
  if (pr.statusCheckRollup.length > 0) {
    console.log(`  ${BOLD}CI Checks:${RESET}`);
    for (const check of pr.statusCheckRollup) {
      const name = check.name || check.status || 'unknown';
      console.log(`    ${checkIcon(check.conclusion)} ${name}${check.status === 'IN_PROGRESS' ? ` ${YELLOW}(running)${RESET}` : ''}`);
    }
    console.log('');
  }

  // Review comments
  if (reviewComments.length > 0) {
    console.log(`  ${BOLD}Review Comments (${reviewComments.length}):${RESET}`);
    for (const c of reviewComments) {
      const preview = c.body.split('\n')[0]!.substring(0, 80);
      console.log(`    ${CYAN}${c.author}${RESET} on ${DIM}${c.path}${c.line ? `:${c.line}` : ''}${RESET}`);
      console.log(`      ${preview}${c.body.length > 80 ? '...' : ''}`);
    }
    console.log('');
  }

  // Conversation summary
  if (conversationComments) {
    const lines = conversationComments.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      console.log(`  ${BOLD}Conversation:${RESET} ${lines.length} lines`);
      // Show first few meaningful lines
      const meaningful = lines.filter(l => !l.startsWith('GraphQL:') && l.length > 10).slice(0, 5);
      for (const line of meaningful) {
        console.log(`    ${DIM}${line.substring(0, 100)}${RESET}`);
      }
      console.log('');
    }
  }
}

async function printPRList(json: boolean, repos: RepoConfig[]): Promise<void> {
  const { prs, errors } = await listAllOpenPRs(repos);

  const scored: PR[] = prs.map(pr => {
    const breakdown = computeScore(pr);
    return { ...pr, score: breakdown.total, scoreBreakdown: breakdown };
  }).sort((a, b) => b.score - a.score);

  if (json) {
    console.log(JSON.stringify({ prs: scored, errors }, null, 2));
    return;
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.log(`  ${YELLOW}⚠️  ${err}${RESET}`);
    }
  }

  console.log('');
  console.log(`  ${BOLD}Open PRs (${scored.length})${RESET}`);
  console.log(`  ${'─'.repeat(70)}`);

  if (scored.length === 0) {
    console.log(`  ${DIM}No open PRs found.${RESET}`);
    return;
  }

  for (const pr of scored) {
    const score = colorScore(pr.score);
    const draft = pr.isDraft ? `${DIM}[draft]${RESET} ` : '';
    const repo = `${DIM}${pr.repo.repo}${RESET}`;
    console.log(`  ${score} ${BOLD}#${pr.number}${RESET} ${draft}${pr.title}`);
    console.log(`       ${repo} · ${pr.author} · +${pr.additions} -${pr.deletions}`);
  }
  console.log('');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (args.tui) {
    // Dynamic import to avoid loading Ink when not needed
    await import('./index.js');
    return;
  }

  if (args.prNumber) {
    // Find PR across repos (or use specified repo)
    const repos = args.repo ? [args.repo] : REPOS;
    const { prs } = await listAllOpenPRs(repos);
    const matches = prs.filter(p => p.number === args.prNumber);

    if (matches.length === 0) {
      console.error(`${RED}PR #${args.prNumber} not found in ${repos.map(r => `${r.owner}/${r.repo}`).join(', ')}${RESET}`);
      process.exit(1);
    }

    if (matches.length > 1 && !args.repo) {
      console.error(`${RED}PR #${args.prNumber} exists in multiple repos: ${matches.map(m => `${m.repo.owner}/${m.repo.repo}`).join(', ')}${RESET}`);
      console.error(`${RED}Use --repo to disambiguate (e.g. --repo ${matches[0]!.repo.owner}/${matches[0]!.repo.repo})${RESET}`);
      process.exit(1);
    }

    const match = matches[0]!;
    const breakdown = computeScore(match);
    const pr: PR = { ...match, score: breakdown.total, scoreBreakdown: breakdown };
    await printPRDetail(pr, pr.repo, args.json);
  } else {
    await printPRList(args.json, args.repo ? [args.repo] : REPOS);
  }
}

main().catch(err => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${RED}Error: ${message}${RESET}`);
  process.exit(1);
});
