# pr-ready-tui

A terminal dashboard that scores your GitHub PRs on merge-readiness and lets you dispatch AI coding agents to review or fix them.

Built with [Ink](https://github.com/vadimdemedes/ink) (React for the terminal).

```
┌─ PR Ready ──────────────────────────────── 5 PRs ─┐
│                                                    │
│  23  #142  Add OAuth login         ai-estimates    │
│  67  #89   Fix date parsing        design-build    │
│  85  #201  Update README           my-app          │
│  91  #55   Bump dependencies       my-app          │
│                                                    │
│  [↑↓] Navigate  [Enter] Detail  [a] Agent  [q] Quit│
└────────────────────────────────────────────────────┘
```

## What it does

- Fetches open PRs across multiple GitHub repos
- Scores each PR 0-100 based on CI status, review state, merge conflicts, and staleness
- Shows a detailed breakdown when you drill into a PR
- Copies agent commands to your clipboard so you can dispatch Claude Code, Codex, Copilot, or Amp to review/fix PRs

## Prerequisites

- **Node.js** >= 18
- **GitHub CLI** (`gh`) — [install](https://cli.github.com/) and authenticate with `gh auth login`
- **tmux** (optional) — for agent session management

## Install

```bash
git clone https://github.com/danieljsmythe26/pr-ready-tui.git
cd pr-ready-tui
npm install
```

## Configure your repos

Tell pr-ready which repos to monitor. Pick one:

### Option A: Environment variable

```bash
export PRT_REPOS="owner/repo1,owner/repo2,owner/repo3"
```

### Option B: Config file

Create `~/.pr-ready.json` (or `.pr-ready.json` in the project root):

```json
{
  "repos": [
    "owner/repo1",
    "owner/repo2",
    "owner/repo3"
  ]
}
```

You can also use the object format for repos with custom local paths:

```json
{
  "repos": [
    { "owner": "myorg", "repo": "frontend", "localPath": "/path/to/frontend" },
    "myorg/backend"
  ]
}
```

### Optional: Set repos directory

If your repos live somewhere other than `~/Documents/coding`, set:

```bash
export PRT_REPOS_DIR=~/code
```

This is used for agent spawning — it tells pr-ready where to `cd` before running agent commands.

## Usage

### TUI mode (interactive dashboard)

```bash
npm run dev
```

### CLI mode (quick checks)

```bash
# List all open PRs with scores
npx tsx src/cli.ts

# Check a specific PR
npx tsx src/cli.ts 142

# JSON output (for piping to other tools)
npx tsx src/cli.ts --json

# Check a PR in a specific repo
npx tsx src/cli.ts 142 --repo owner/repo
```

## Keybindings

| Key | Action |
|-----|--------|
| `↑` / `↓` or `j` / `k` | Navigate PR list |
| `Enter` | View PR detail |
| `Escape` | Back to list |
| `a` | Pick an AI agent to dispatch |
| `r` | Refresh PRs |
| `b` | Toggle bot PRs |
| `s` | Cycle sort (score / updated / created) |
| `f` | Cycle repo filter |
| `l` | Toggle "review" label |
| `o` | Open PR in browser |
| `m` | Merge PR (with confirmation) |
| `?` | Help screen |
| `q` | Quit |

## Scoring

Each PR gets a score from 0 (needs work) to 100 (ready to merge):

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| CI | 30 | Are all checks passing? |
| Reviews | 30 | Approved? Changes requested? |
| Conflicts | 20 | Can it merge cleanly? |
| Staleness | 20 | How recently was it updated? |

## AI Agents

When you press `a` on a PR, you can pick from:

- **Claude Code** — dispatches a review or fix task
- **Codex** — OpenAI's coding agent
- **GitHub Copilot** — via `gh copilot`
- **Amp** — Sourcegraph's coding agent

The agent command is copied to your clipboard. Paste it into a terminal to run.

## Development

```bash
npm run dev          # Run with tsx
npm test             # Run tests
npm run typecheck    # Type check
npm run build        # Build to dist/
```

## License

MIT
