import React from 'react';
import { Box, Text } from 'ink';
import type { View } from '../types.js';

interface StatusBarProps {
  view: View;
  hideBots: boolean;
  reviewDone: boolean;
  agentCopied: boolean;
  agentError: string | null;
  boxWidth: number;
}

export function StatusBar({ view, hideBots, reviewDone, agentCopied, agentError, boxWidth }: StatusBarProps) {
  if (agentError) {
    return (
      <Box marginTop={1}>
        <Text color="red">Agent failed: {agentError}</Text>
      </Box>
    );
  }

  if (agentCopied) {
    return (
      <Box marginTop={1}>
        <Text>
          <Text color="green">Command copied! </Text>
          <Text dimColor>Paste in a new terminal to run agent</Text>
        </Text>
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
          <Text dimColor>{'['}</Text><Text color="cyan">s</Text><Text dimColor>{'] sort  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">/</Text><Text dimColor>{'] filter  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">Enter</Text><Text dimColor>{'] detail  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">?</Text><Text dimColor>{'] help'}</Text>
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
          <Text dimColor>{'['}</Text><Text color="cyan">m</Text><Text dimColor>{'] merge  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">y</Text><Text dimColor>{'] copy URL  '}</Text>
          <Text dimColor>{'['}</Text><Text color="cyan">?</Text><Text dimColor>{'] help'}</Text>
        </Text>
      </Box>
    );
  }

  return null;
}
