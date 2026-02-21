# Codex Handover — Stream A (Tests + Infrastructure)

## Context

This is a TypeScript TUI app built with Ink (React for terminal). It's a PR readiness dashboard that scores GitHub PRs and lets you dispatch agents to review/fix them.

**Branch:** `feature/oc-94-v2-completions`
**Repo:** `~/tmp/pr-ready-tui-codex/` (your working copy)

Another developer (Dawd) is working on new features in parallel on the same branch. Your changes should be committed and pushed before his, to minimise conflicts.

## Your Tasks

### A1: Add vitest test framework
- `npm install -D vitest`
- Create `vitest.config.ts` at repo root
- Update `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`

### A2: Unit tests for scoring.ts
File: `src/__tests__/scoring.test.ts`

Test `computeScore()` with these cases:
- All CI passed + approved + mergeable + fresh → score 100
- All CI failed + changes requested + conflicting + stale (30+ days) → score 0
- No CI checks (empty array) → CI score should be 15
- Mixed: CI passed but changes requested and conflicting
- Staleness boundaries: <1 day, 1-3 days, 3-7 days, 7-14 days, >14 days
- Each sub-scorer independently (scoreCi, scoreReviews, scoreConflicts, scoreStaleness)

Note: The sub-scorers are not exported. Either test via `computeScore()` or export them. Prefer exporting them — they're pure functions.

### A3: Unit tests for types.ts
File: `src/__tests__/types.test.ts`

Test `isBotAuthor()`:
- `"dependabot"` → true
- `"dependabot[bot]"` → true
- `"app/dependabot"` → true
- `"renovate"` → true
- `"renovate[bot]"` → true
- `"snyk-bot"` → true
- `"danieljsmythe26"` → false
- `"some-random-user"` → false
- Case insensitivity: `"Dependabot"`, `"DEPENDABOT[BOT]"`

### A4: Unit tests for github.ts
File: `src/__tests__/github.test.ts`

Mock the `gh` CLI calls (mock `child_process.execFile`). Test:
- `listOpenPRs` maps raw GH response correctly
- Missing fields handled gracefully (null statusCheckRollup, etc.)
- `listAllOpenPRs` aggregates multiple repos, captures per-repo errors

### A5: Fix gh args splitting
In `src/github.ts`, the `gh()` function splits args with `args.split(/\s+/)`. Refactor to pass args as arrays:

```typescript
// Before
async function gh<T>(args: string): Promise<T> {
  const { stdout } = await execFileAsync('gh', args.split(/\s+/), ...);

// After
async function gh<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync('gh', args, ...);
```

Update all callers. Keep the same public API for `listOpenPRs` and `listAllOpenPRs`.

### A6: Make repo path configurable
In `src/hooks/useAgent.ts`, line:
```typescript
const repoPath = `/home/clawdbot/coding/${repo.repo}`;
```

Replace with:
```typescript
const baseDir = process.env.PRT_REPOS_DIR || process.cwd();
const repoPath = path.join(baseDir, repo.repo);
```

Import `path` from `node:path`.

### A7: Remove unused deps
These are imported nowhere in the codebase:
- `commander`
- `ora`
- `@clack/prompts`
- `chalk`
- `chokidar`

Run `npm uninstall commander ora @clack/prompts chalk chokidar`

### A8: Error boundary component
Create `src/components/ErrorBoundary.tsx`:

A React class component (Ink doesn't support hooks for error boundaries) that:
- Catches render errors
- Shows a friendly message: "Something went wrong: {error.message}"
- Shows hint: "Press q to quit, r to retry"

Wrap `<App />` in `<ErrorBoundary>` in `src/index.tsx`.

## Rules

1. **Commit each task separately** with message format: `feat(A1): description` or `fix(A5): description`
2. **Do NOT modify** `src/App.tsx`, `src/components/PRDetail.tsx`, `src/components/PRList.tsx`, `src/components/PRCard.tsx`, `src/components/StatusBar.tsx`, `src/components/AgentPicker.tsx` — Dawd is working on these
3. **Run `npm run typecheck` after each change** — must pass
4. **Run `npm test` after adding tests** — must pass
5. **Push to `feature/oc-94-v2-completions`** when done

## Order

Do A7 first (cleanup), then A1 (test framework), then A5+A6 (fixes), then A2+A3+A4 (tests), then A8 (error boundary).
