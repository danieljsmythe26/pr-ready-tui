# PR Ready TUI — Project Context

## Claude Instructions

### Communication Rules

#### ASCII Before/After Rule
**BLOCKING REQUIREMENT**: When the user asks for "ASCII", "before and after", or any visual mockup of a change:
1. Show the ASCII diagram ONLY — do NOT make any code changes in the same response
2. STOP and wait for explicit approval (e.g. "yes", "go ahead", "do it")
3. Only then make the edit in a follow-up response

### Scope Discipline
**IMPORTANT: Only do what was explicitly discussed or requested. Do NOT:**
1. Fix "related" bugs or issues that weren't asked about
2. Refactor or improve code that wasn't part of the task
3. Update other files "while I'm at it"
4. Make changes you think are helpful but weren't requested

If you notice something that could be improved, ASK FIRST — don't just do it.

### Documentation Policy
- **Do NOT create markdown files** without explicit user approval
- If information belongs somewhere, ask the user first

---

## Project Overview

TypeScript TUI app built with **Ink** (React for terminal). A PR readiness dashboard that scores GitHub PRs across multiple repos and lets you dispatch AI agents to review/fix them.

```
[GitHub API via gh CLI] → [PR scoring engine] → [Ink TUI] → [tmux agent sessions]
```

### Key Tech
- **Runtime:** Node.js with tsx for dev
- **UI:** Ink (React for terminal) + React 19
- **Testing:** Vitest
- **Build:** TypeScript (`tsc`)
- **CLI dependency:** `gh` (GitHub CLI) for all GitHub API calls

---

## Development Commands

```bash
# Development (requires PRT_REPOS_DIR for agent spawning)
PRT_REPOS_DIR=~/Documents/coding npm run dev

# Testing
npm test              # vitest run (18 tests)
npm run test:watch    # vitest watch mode

# Type checking
npm run typecheck     # tsc --noEmit

# Build
npm run build         # tsc → dist/
```

### MUST Requirements
- Always run `npm test` after making code changes
- Always run `npm run typecheck` after tests pass — must pass clean with zero errors
- Never commit without explicit user approval

---

## Project Structure

```
src/
  index.tsx           # Entry point, wraps App in ErrorBoundary
  App.tsx             # Main component, view routing, keybindings
  types.ts            # PR/Agent types, AGENTS config, bot detection
  github.ts           # gh CLI wrapper (listOpenPRs, getReviewComments)
  scoring.ts          # PR scoring algorithm (CI, reviews, conflicts, staleness)
  hooks/
    useAgent.ts       # tmux session spawning for agents
    usePRs.ts         # PR fetching + scoring pipeline
    useScroll.ts      # Scroll state for detail view
  components/
    Header.tsx        # Top bar with PR count
    PRList.tsx        # PR list view
    PRCard.tsx        # Individual PR row
    PRDetail.tsx      # Detailed PR view with CI, comments, score
    AgentPicker.tsx   # Agent selection overlay
    MergeConfirm.tsx  # Merge confirmation prompt
    StatusBar.tsx     # Bottom keybinding hints
    ErrorBoundary.tsx # React error boundary
  __tests__/
    scoring.test.ts   # 12 tests — scoring algorithm
    types.test.ts     # 3 tests — bot author detection
    github.test.ts    # 3 tests — gh CLI mocking + PR mapping
```

### Monitored Repos
Configured in `src/types.ts` → `REPOS` array:
- `danieljsmythe26/ai-estimates-app`
- `danieljsmythe26/design-build-automation`
- `danieljsmythe26/ashton-paul`

---

## Architecture Notes

### Agent Spawning
Agents are spawned in **tmux sessions** via `useAgent.ts`. The TUI polls `tmux has-session` every 3s to detect completion. Agent commands are defined in `src/types.ts` → `AGENTS` array.

### GitHub API Access
All GitHub access goes through the `gh` CLI (not direct API calls). The `gh()` and `ghRaw()` helpers in `github.ts` wrap `execFile('gh', ...)` with promisify.

### PR Scoring
`scoring.ts` computes a 0–100 score from four sub-scores: CI status, review decision, merge conflicts, and staleness. Sub-scorers are exported as pure functions.

---

## Branch Strategy
- **`main`** — stable releases
- **Feature branches** — PRs against main
- Current active branch: `feature/oc-94-v2-completions`
