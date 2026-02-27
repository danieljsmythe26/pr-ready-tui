import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { execFile } from 'node:child_process';
import type { View, AgentAction } from './types.js';
import { AGENTS } from './types.js';
import { usePRs } from './hooks/usePRs.js';
import { useAgent } from './hooks/useAgent.js';
import { useScroll } from './hooks/useScroll.js';
import { Header } from './components/Header.js';
import { PRList } from './components/PRList.js';
import { PRDetail } from './components/PRDetail.js';
import { AgentPicker } from './components/AgentPicker.js';
import { MergeConfirm } from './components/MergeConfirm.js';
import { StatusBar } from './components/StatusBar.js';
import { HelpOverlay } from './components/HelpOverlay.js';

const MIN_WIDTH = 60;
const MAX_WIDTH = 200;
const TWO_PANE_MIN = 120;
const DETAIL_VIEWPORT = 20;
const MAX_DETAIL_LINES = 100;

function useTerminalWidth(): number {
  const { stdout } = useStdout();
  const [width, setWidth] = useState(() =>
    Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, stdout?.columns ?? 90))
  );

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, stdout.columns ?? 90)));
    };
    stdout.on('resize', onResize);
    return () => { stdout.off('resize', onResize); };
  }, [stdout]);

  return width;
}

export function App() {
  const { exit } = useApp();
  const BOX_WIDTH = useTerminalWidth();
  const { prs, loading, error, refresh, hideBots, toggleBots, sortBy, toggleSort, repoFilter, cycleRepoFilter, updatePR } = usePRs();

  const [view, setView] = useState<View>('list');
  const [prevView, setPrevView] = useState<View>('list');
  const [selectedPR, setSelectedPR] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [agentAction, setAgentAction] = useState<AgentAction>('review');
  const [reviewedPRs, setReviewedPRs] = useState<Set<string>>(new Set());
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const { scrollOffset, scrollUp, scrollDown, pageUp, pageDown, resetScroll } = useScroll();
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Clamp selectedPR to valid range whenever prs changes
  useEffect(() => {
    if (prs.length > 0 && selectedPR >= prs.length) {
      setSelectedPR(prs.length - 1);
    }
  }, [prs.length, selectedPR]);

  const clampedIndex = prs.length === 0 ? 0 : Math.min(selectedPR, prs.length - 1);

  const handleAgentComplete = useCallback(() => {
    refresh();
  }, [refresh]);

  const { running: agentRunning, sessionName: agentSession, error: agentError, spawn } = useAgent(handleAgentComplete);

  const isTTY = process.stdin.isTTY ?? false;

  const currentPR = prs[clampedIndex];
  const twoPane = BOX_WIDTH >= TWO_PANE_MIN;
  const leftWidth = twoPane ? Math.floor(BOX_WIDTH * 0.4) : BOX_WIDTH;
  const rightWidth = twoPane ? BOX_WIDTH - leftWidth : BOX_WIDTH;

  // Reset scroll when selection changes in two-pane mode
  const [lastSelected, setLastSelected] = useState(0);
  useEffect(() => {
    if (twoPane && clampedIndex !== lastSelected) {
      resetScroll();
      setLastSelected(clampedIndex);
    }
  }, [twoPane, clampedIndex, lastSelected, resetScroll]);

  const doMerge = useCallback(() => {
    if (!currentPR) return;
    setMergeStatus('Merging...');
    const args = ['pr', 'merge', String(currentPR.number), '--repo',
      `${currentPR.repo.owner}/${currentPR.repo.repo}`, '--squash', '--delete-branch'];
    execFile('gh', args, { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        setMergeStatus(`Failed: ${stderr || err.message}`);
        setTimeout(() => setMergeStatus(null), 5000);
      } else {
        setMergeStatus(`Merged! ${stdout.trim()}`);
        setTimeout(() => {
          setMergeStatus(null);
          refresh();
          setView('list');
        }, 3000);
      }
    });
  }, [currentPR, refresh]);

  useInput((input, key) => {
    // Global
    if (input === '?' && (view === 'list' || view === 'detail')) {
      setPrevView(view);
      setView('help');
      return;
    }
    if (input === 'q' && view !== 'agent-picker' && view !== 'merge-confirm') {
      exit();
      return;
    }

    if (view === 'list') {
      if (key.upArrow && prs.length > 0) {
        setSelectedPR(i => Math.max(0, i - 1));
      } else if (key.downArrow && prs.length > 0) {
        setSelectedPR(i => Math.min(prs.length - 1, i + 1));
      } else if (key.return && prs.length > 0) {
        resetScroll();
        setView('detail');
      } else if (input === 'r') {
        refresh();
      } else if (input === 'b') {
        toggleBots();
        setSelectedPR(0);
      } else if (input === 's') {
        toggleSort();
      } else if (input === '/') {
        cycleRepoFilter();
        setSelectedPR(0);
      } else if (twoPane && input === 'u' && key.ctrl) {
        pageUp(DETAIL_VIEWPORT);
      } else if (twoPane && input === 'd' && key.ctrl) {
        pageDown(MAX_DETAIL_LINES, DETAIL_VIEWPORT);
      } else if (twoPane && input === 'y' && currentPR) {
        const cmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip';
        const args = process.platform === 'darwin' ? [] : ['-selection', 'clipboard'];
        const child = execFile(cmd, args, { timeout: 5000 }, (err) => {
          if (err) {
            setCopyStatus('Copy failed');
          } else {
            setCopyStatus('Copied!');
          }
          setTimeout(() => setCopyStatus(null), 2000);
        });
        child.stdin?.write(currentPR.url);
        child.stdin?.end();
      } else if (twoPane && input === 'o' && currentPR) {
        execFile('gh', ['pr', 'view', '--web', String(currentPR.number), '--repo',
          `${currentPR.repo.owner}/${currentPR.repo.repo}`], { timeout: 10_000 }, () => {});
      } else if (twoPane && input === 'v') {
        setAgentAction('review');
        setSelectedAgent(0);
        setView('agent-picker');
      } else if (twoPane && input === 'm' && currentPR) {
        setView('merge-confirm');
      }
    } else if (view === 'detail') {
      if (key.escape) {
        setView('list');
      } else if (key.upArrow) {
        scrollUp();
      } else if (key.downArrow) {
        scrollDown(MAX_DETAIL_LINES, DETAIL_VIEWPORT);
      } else if (input === 'u' && key.ctrl) {
        pageUp(DETAIL_VIEWPORT);
      } else if (input === 'd' && key.ctrl) {
        pageDown(MAX_DETAIL_LINES, DETAIL_VIEWPORT);
      } else if (input === 'y') {
        if (currentPR) {
          const cmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip';
          const args = process.platform === 'darwin' ? [] : ['-selection', 'clipboard'];
          const child = execFile(cmd, args, { timeout: 5000 }, (err) => {
            if (err) {
              setCopyStatus('Copy failed');
            } else {
              setCopyStatus('Copied!');
            }
            setTimeout(() => setCopyStatus(null), 2000);
          });
          child.stdin?.write(currentPR.url);
          child.stdin?.end();
        }
      } else if (input === 'o') {
        if (currentPR) {
          execFile('gh', ['pr', 'view', '--web', String(currentPR.number), '--repo',
            `${currentPR.repo.owner}/${currentPR.repo.repo}`], { timeout: 10_000 }, () => {});
        }
      } else if (input === 'v') {
        setAgentAction('review');
        setSelectedAgent(0);
        setView('agent-picker');
      } else if (input === 'f' && currentPR && reviewedPRs.has(`${currentPR.repo.repo}-${currentPR.number}`)) {
        setAgentAction('fix');
        setSelectedAgent(0);
        setView('agent-picker');
      } else if (input === 't') {
        setAgentAction('fix-types');
        setSelectedAgent(0);
        setView('agent-picker');
      } else if (input === 'x') {
        // Rebase — spawn in tmux
        if (currentPR) {
          spawn(
            {
              id: 'rebase',
              name: 'Git Rebase',
              command: (_repo, pr) =>
                `git fetch origin && git checkout ${pr.headRefName} && git rebase origin/${pr.baseRefName}`,
            },
            currentPR.repo,
            currentPR,
            'fix'
          );
        }
      } else if (input === 'm') {
        if (currentPR) {
          setView('merge-confirm');
        }
      }
    } else if (view === 'agent-picker') {
      if (key.escape) {
        setView('detail');
      } else if (key.upArrow) {
        setSelectedAgent(i => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedAgent(i => Math.min(AGENTS.length - 1, i + 1));
      } else if (key.return) {
        const clampedIdx = Math.min(Math.max(selectedPR, 0), prs.length - 1);
        const pr = prs[clampedIdx];
        const agent = AGENTS[selectedAgent];
        if (pr && agent) {
          spawn(agent, pr.repo, pr, agentAction);
          if (agentAction === 'review') {
            setReviewedPRs(s => new Set(s).add(`${pr.repo.repo}-${pr.number}`));
            // TODO: capture review output and set reviewVerdict via updatePR
          }
          setView('detail');
        }
      }
    } else if (view === 'merge-confirm') {
      if (input === 'y') {
        doMerge();
        setView('detail');
      } else if (key.escape || input === 'n') {
        setView('detail');
      }
    } else if (view === 'help') {
      if (key.escape || input === '?') {
        setView(prevView);
      }
    }
  }, { isActive: isTTY });

  const reviewDone = currentPR ? reviewedPRs.has(`${currentPR.repo.repo}-${currentPR.number}`) : false;

  const innerWidth = BOX_WIDTH - 2;

  return (
    <Box flexDirection="column" padding={0}>
      <Header totalPRs={prs.length} hideBots={hideBots} loading={loading} boxWidth={BOX_WIDTH} sortBy={sortBy} repoFilter={repoFilter} splitAt={twoPane && view === 'list' ? leftWidth : undefined} />

      {view === 'list' && !twoPane && (
        <PRList prs={prs} selectedIndex={selectedPR} loading={loading} error={error} boxWidth={BOX_WIDTH} />
      )}

      {view === 'list' && twoPane && (
        <Box flexDirection="row">
          <Box flexDirection="column" width={leftWidth}>
            <PRList prs={prs} selectedIndex={selectedPR} loading={loading} error={error} boxWidth={leftWidth} condensed />
          </Box>
          <Box flexDirection="column" width={rightWidth}>
            {currentPR ? (
              <PRDetail pr={currentPR} boxWidth={rightWidth} scrollOffset={scrollOffset} leftBorder={false} />
            ) : (
              <Text dimColor>{' '.repeat(rightWidth - 1) + '│'}</Text>
            )}
          </Box>
        </Box>
      )}

      {view === 'detail' && currentPR && (
        <PRDetail pr={currentPR} boxWidth={BOX_WIDTH} scrollOffset={scrollOffset} />
      )}

      {view === 'agent-picker' && (
        <AgentPicker action={agentAction} selectedIndex={selectedAgent} boxWidth={BOX_WIDTH} />
      )}

      {view === 'merge-confirm' && currentPR && (
        <MergeConfirm pr={currentPR} boxWidth={BOX_WIDTH} />
      )}

      {view === 'help' && (
        <HelpOverlay boxWidth={BOX_WIDTH} />
      )}

      {/* Copy status */}
      {copyStatus && (
        <Text>
          <Text dimColor>{'│  '}</Text>
          <Text color="green">{copyStatus}</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 2 - copyStatus.length)) + '│'}</Text>
        </Text>
      )}

      {/* Merge status */}
      {mergeStatus && (
        <Text>
          <Text dimColor>{'│  '}</Text>
          <Text color="yellow">{mergeStatus}</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 2 - mergeStatus.length)) + '│'}</Text>
        </Text>
      )}

      {/* Bottom border */}
      {twoPane && view === 'list' ? (
        <Text dimColor>{'└' + '─'.repeat(leftWidth - 2) + '┴' + '─'.repeat(rightWidth - 1) + '┘'}</Text>
      ) : (
        <Text dimColor>{'└' + '─'.repeat(innerWidth) + '┘'}</Text>
      )}

      <StatusBar
        view={view}
        hideBots={hideBots}
        reviewDone={reviewDone}
        agentRunning={agentRunning}
        agentSession={agentSession}
        agentError={agentError}
        boxWidth={BOX_WIDTH}
      />
    </Box>
  );
}
