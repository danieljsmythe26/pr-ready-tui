import React from 'react';
import { Box, Text } from 'ink';
import { AGENTS } from '../types.js';
import type { AgentAction } from '../types.js';

interface AgentPickerProps {
  action: AgentAction;
  selectedIndex: number;
  boxWidth: number;
}

const ACTION_LABELS: Record<AgentAction, string> = {
  review: 'Review PR',
  fix: 'Fix Issues',
  'fix-types': 'Fix TypeScript Errors',
};

export function AgentPicker({ action, selectedIndex, boxWidth }: AgentPickerProps) {
  const innerWidth = boxWidth - 2;

  return (
    <Box flexDirection="column">
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text bold color="cyan">{'Select agent for: '}</Text>
        <Text bold>{ACTION_LABELS[action]}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 20 - ACTION_LABELS[action].length)) + '│'}</Text>
      </Text>
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      {AGENTS.map((agent, i) => (
        <Text key={agent.id}>
          <Text dimColor>{'│  '}</Text>
          {i === selectedIndex
            ? <Text color="cyan" bold>{'> '}{agent.name}</Text>
            : <Text>{'  '}{agent.name}</Text>
          }
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 4 - agent.name.length)) + '│'}</Text>
        </Text>
      ))}
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text dimColor>{'[Enter] select  [Esc] cancel'}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 30)) + '│'}</Text>
      </Text>
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
    </Box>
  );
}
