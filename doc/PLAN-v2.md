# OC-94 v2 — PR Readiness TUI Completions

## Master Plan

Complete the missing features from the OC-94 spec, fix issues from code review, and add test coverage.

### What's missing (from spec audit)

1. **Review comments in detail view** — PRDetail should fetch and display full review comment text
2. **Rebase action `[x]`** — spawn `git rebase` in tmux
3. **Merge action `[m]`** — run `gh pr merge` with confirmation prompt
4. **Scrollable detail view** — detail view needs scroll for long content
5. **Review verdict → fix handover** — review output should be captured and fed to fix agent

### What needs fixing (from code review)

6. **Tests** — no tests exist. Scoring, bot filtering, and GitHub data mapping are all testable
7. **`gh` args splitting** — `args.split(/\s+/)` is fragile, should use proper array args
8. **Hardcoded repo path** — `/home/clawdbot/coding/${repo.repo}` won't work on Mac/other machines
9. **PRDetail padding** — several lines use `Math.max(1, 5)` (always 5), needs dynamic calc
10. **No error boundary** — gh CLI missing/unauthed crashes ungracefully
11. **Unused deps** — commander, ora, @clack/prompts, chalk, chokidar not imported

---

## Parallel Work Streams

### Stream A — Codex (tests + infrastructure fixes)

Focus: tests, robustness, cleanup. No new features.

| # | Task | Files |
|---|---|---|
| A1 | Add test framework (vitest) + config | package.json, vitest.config.ts |
| A2 | Unit tests for `scoring.ts` — all score functions, edge cases | src/__tests__/scoring.test.ts |
| A3 | Unit tests for `types.ts` — `isBotAuthor()` with all variants | src/__tests__/types.test.ts |
| A4 | Unit tests for `github.ts` — mock `gh` CLI, test PR mapping | src/__tests__/github.test.ts |
| A5 | Fix `gh` args splitting — refactor to use array args properly | src/github.ts |
| A6 | Make repo path configurable (env var or `cwd`) instead of hardcoded | src/hooks/useAgent.ts |
| A7 | Remove unused deps from package.json | package.json |
| A8 | Add error boundary component for graceful crash handling | src/components/ErrorBoundary.tsx |

### Stream B — Dawd (features + UI)

Focus: missing spec features, UI improvements.

| # | Task | Files |
|---|---|---|
| B1 | Fetch review comments via `gh` and add to PR type | src/github.ts, src/types.ts |
| B2 | Display review comments in PRDetail (with scrolling) | src/components/PRDetail.tsx |
| B3 | Add scrollable detail view (useInput for scroll, viewport) | src/components/PRDetail.tsx, src/hooks/useScroll.ts |
| B4 | Implement rebase action `[x]` — spawn in tmux | src/App.tsx, src/hooks/useAgent.ts |
| B5 | Implement merge action `[m]` — `gh pr merge` with confirmation | src/App.tsx, src/components/MergeConfirm.tsx |
| B6 | Capture review verdict and pass to fix agent | src/hooks/useAgent.ts, src/App.tsx |
| B7 | Fix PRDetail padding (dynamic width calc) | src/components/PRDetail.tsx |

---

## Merge Strategy

1. Both streams work on `feature/oc-94-v2-completions`
2. Codex works in `~/tmp/pr-ready-tui-codex/` (clone), pushes to same branch
3. Dawd works in `~/coding/pr-ready-tui/`
4. After both done: pull, resolve any conflicts, run tests + typecheck
5. Final review of combined changes
6. Push, open PR against main

## File Ownership (avoid conflicts)

| File | Stream A (Codex) | Stream B (Dawd) |
|---|---|---|
| src/scoring.ts | ✏️ (no changes, just tests) | — |
| src/github.ts | ✏️ (fix args splitting) | ✏️ (add review comments fetch) |
| src/types.ts | — | ✏️ (add ReviewComment to PR) |
| src/hooks/useAgent.ts | ✏️ (configurable path) | ✏️ (rebase + review capture) |
| src/App.tsx | — | ✏️ (new keybindings) |
| src/components/PRDetail.tsx | — | ✏️ (comments + scroll + padding) |
| src/__tests__/* | ✏️ (all new) | — |
| package.json | ✏️ (vitest + remove unused) | — |

**Conflict risk:** `github.ts` and `useAgent.ts` — both streams touch these. Codex does infrastructure fixes, Dawd adds features. Should merge cleanly if Codex doesn't restructure exports.
