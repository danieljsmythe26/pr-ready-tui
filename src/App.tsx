import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
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

const BOX_WIDTH = 90;
const DETAIL_VIEWPORT = 20;

export function App() {
  const { exit } = useApp();
  const { prs, loading, error, refresh, hideBots, toggleBots, updatePR } = usePRs();

  const [view, setView] = useState<View>('list');
  const [selectedPR, setSelectedPR] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [agentAction, setAgentAction] = useState<AgentAction>('review');
  const [reviewedPRs, setReviewedPRs] = useState<Set<string>>(new Set());
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const { scrollOffset, scrollUp, scrollDown, resetScroll } = useScroll();

  // Clamp selectedPR to valid range whenever prs changes
  const clampedIndex = prs.length === 0 ? 0 : Math.min(selectedPR, prs.length - 1);
  if (clampedIndex !== selectedPR) {
    setSelectedPR(clampedIndex);
  }

  const handleAgentComplete = useCallback(() => {
    refresh();
  }, [refresh]);

  const { running: agentRunning, sessionName: agentSession, spawn } = useAgent(handleAgentComplete);

  const isTTY = process.stdin.isTTY ?? false;

  const currentPR = prs[clampedIndex];

  const doMerge = useCallback(() => {
    if (!currentPR) return;
    setMergeStatus('Merging...');
    const args = ['pr', 'merge', String(currentPR.number), '--repo',
      `${currentPR.repo.owner}/${currentPR.repo.repo}`, '--squash', '--delete-branch'];
    execFile('gh', args, (err, stdout, stderr) => {
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
    if (input === 'q' && view !== 'agent-picker' && view !== 'merge-confirm') {
      exit();
      return;
    }

    if (view === 'list') {
      if (key.upArrow) {
        setSelectedPR(i => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedPR(i => Math.min(prs.length - 1, i + 1));
      } else if (key.return && prs.length > 0) {
        resetScroll();
        setView('detail');
      } else if (input === 'r') {
        refresh();
      } else if (input === 'b') {
        toggleBots();
        setSelectedPR(0);
      }
    } else if (view === 'detail') {
      if (key.escape) {
        setView('list');
      } else if (key.upArrow) {
        scrollUp();
      } else if (key.downArrow) {
        scrollDown(50, DETAIL_VIEWPORT); // 50 is approx max lines
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
          setView('merge-confirm' as View);
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
        const pr = prs[selectedPR];
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
    } else if ((view as string) === 'merge-confirm') {
      if (input === 'y') {
        doMerge();
        setView('detail');
      } else if (key.escape || input === 'n') {
        setView('detail');
      }
    }
  }, { isActive: isTTY });

  const reviewDone = currentPR ? reviewedPRs.has(`${currentPR.repo.repo}-${currentPR.number}`) : false;

  const innerWidth = BOX_WIDTH - 2;

  return (
    <Box flexDirection="column" padding={0}>
      <Header totalPRs={prs.length} hideBots={hideBots} loading={loading} boxWidth={BOX_WIDTH} />

      {view === 'list' && (
        <PRList prs={prs} selectedIndex={selectedPR} loading={loading} error={error} boxWidth={BOX_WIDTH} />
      )}

      {view === 'detail' && currentPR && (
        <PRDetail pr={currentPR} boxWidth={BOX_WIDTH} scrollOffset={scrollOffset} />
      )}

      {view === 'agent-picker' && (
        <AgentPicker action={agentAction} selectedIndex={selectedAgent} boxWidth={BOX_WIDTH} />
      )}

      {(view as string) === 'merge-confirm' && currentPR && (
        <MergeConfirm pr={currentPR} boxWidth={BOX_WIDTH} />
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
      <Text dimColor>{'└' + '─'.repeat(innerWidth) + '┘'}</Text>

      <StatusBar
        view={view}
        hideBots={hideBots}
        reviewDone={reviewDone}
        agentRunning={agentRunning}
        agentSession={agentSession}
        boxWidth={BOX_WIDTH}
      />
    </Box>
  );
}
