import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { View, AgentAction } from './types.js';
import { AGENTS } from './types.js';
import { usePRs } from './hooks/usePRs.js';
import { useAgent } from './hooks/useAgent.js';
import { Header } from './components/Header.js';
import { PRList } from './components/PRList.js';
import { PRDetail } from './components/PRDetail.js';
import { AgentPicker } from './components/AgentPicker.js';
import { StatusBar } from './components/StatusBar.js';

const BOX_WIDTH = 90;

export function App() {
  const { exit } = useApp();
  const { prs, loading, error, refresh, hideBots, toggleBots } = usePRs();

  const [view, setView] = useState<View>('list');
  const [selectedPR, setSelectedPR] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [agentAction, setAgentAction] = useState<AgentAction>('review');
  const [reviewedPRs, setReviewedPRs] = useState<Set<string>>(new Set());

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

  useInput((input, key) => {
    // Global
    if (input === 'q' && view !== 'agent-picker') {
      exit();
      return;
    }

    if (view === 'list') {
      if (key.upArrow) {
        setSelectedPR(i => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedPR(i => Math.min(prs.length - 1, i + 1));
      } else if (key.return && prs.length > 0) {
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
      } else if (input === 'm') {
        // Merge — just show the command to run
        const pr = prs[selectedPR];
        if (pr) {
          // We don't auto-merge, just show the command
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
          }
          setView('detail');
        }
      }
    }
  }, { isActive: isTTY });

  const innerWidth = BOX_WIDTH - 2;
  const currentPR = prs[clampedIndex];
  const reviewDone = currentPR ? reviewedPRs.has(`${currentPR.repo.repo}-${currentPR.number}`) : false;

  return (
    <Box flexDirection="column" padding={0}>
      <Header totalPRs={prs.length} hideBots={hideBots} loading={loading} boxWidth={BOX_WIDTH} />

      {view === 'list' && (
        <PRList prs={prs} selectedIndex={selectedPR} loading={loading} error={error} boxWidth={BOX_WIDTH} />
      )}

      {view === 'detail' && currentPR && (
        <PRDetail pr={currentPR} boxWidth={BOX_WIDTH} />
      )}

      {view === 'agent-picker' && (
        <AgentPicker action={agentAction} selectedIndex={selectedAgent} boxWidth={BOX_WIDTH} />
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
