import React from 'react';
import { Box, Text } from 'ink';
import type { View } from '../types.js';

interface StatusBarProps {
  view: View;
  hideBots: boolean;
  reviewDone: boolean;
  agentRunning: boolean;
  agentSession: string | null;
  boxWidth: number;
}

export function StatusBar({ view, hideBots, reviewDone, agentRunning, agentSession, boxWidth }: StatusBarProps) {
  const innerWidth = boxWidth - 2;

  if (agentRunning && agentSession) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text>
          <Text color="yellow">Agent running in tmux: </Text>
          <Text color="cyan" bold>{agentSession}</Text>
        </Text>
        <Text dimColor>{'  Attach: tmux attach -t '}{agentSession}</Text>
      </Box>
    );
  }

  if (view === 'list') {
    return (
      <Box marginTop={1}>
        <Text>
          <Text dimColor>{'['}</Text><Text color="cyan">q</Text><Text dimColor>{'] quit  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">r</Text><Text dimColor>{'] refresh  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">b</Text><Text dimColor>{'] '}</Text>
          <Text color={hideBots ? 'yellow' : 'green'}>{hideBots ? 'show' : 'hide'}</Text>
          <Text dimColor>{' bots  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">Enter</Text><Text dimColor>{'] detail'}</Text>
        </Text>
      </Box>
    );
  }

  if (view === 'detail') {
    return (
      <Box marginTop={1}>
        <Text>
          <Text dimColor>{'['}</Text><Text color="cyan">Esc</Text><Text dimColor>{'] back  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">↑↓</Text><Text dimColor>{'] scroll  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">v</Text><Text dimColor>{'] review  '}</Text>
          <Text dimColor>{'['}</Text>
          <Text color={reviewDone ? 'cyan' : 'gray'}>f</Text>
          <Text dimColor>{'] fix  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">t</Text><Text dimColor>{'] fix types  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">x</Text><Text dimColor>{'] rebase  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">m</Text><Text dimColor>{'] merge'}</Text>
        </Text>
      </Box>
    );
  }

  return null;
}
