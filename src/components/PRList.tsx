import React from 'react';
import { Box, Text } from 'ink';
import type { PR } from '../types.js';
import { PRCard } from './PRCard.js';

interface PRListProps {
  prs: PR[];
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  boxWidth: number;
}

export function PRList({ prs, selectedIndex, loading, error, boxWidth }: PRListProps) {
  const innerWidth = boxWidth - 2;

  if (loading && prs.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
        <Text>
          <Text dimColor>{'│  '}</Text>
          <Text color="yellow">Loading PRs...</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 2 - 14)) + '│'}</Text>
        </Text>
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
        <Text>
          <Text dimColor>{'│  '}</Text>
          <Text color="red">Error: {error}</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 2 - 7 - error.length)) + '│'}</Text>
        </Text>
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      </Box>
    );
  }

  if (prs.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
        <Text>
          <Text dimColor>{'│  '}</Text>
          <Text color="green">No open PRs found.</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 2 - 19)) + '│'}</Text>
        </Text>
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      </Box>
    );
  }

  // Column headers
  const headerLine = '  SCR REPO         #     TITLE' + ' '.repeat(Math.max(1, innerWidth - 49)) + 'AUTHOR       CI R M';

  return (
    <Box flexDirection="column">
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      <Text>
        <Text dimColor>{'│'}</Text>
        <Text dimColor>{headerLine.slice(0, innerWidth)}</Text>
        <Text dimColor>{'│'}</Text>
      </Text>
      <Text dimColor>{'│' + '─'.repeat(innerWidth) + '│'}</Text>
      {prs.map((pr, i) => (
        <PRCard key={`${pr.repo.repo}-${pr.number}`} pr={pr} selected={i === selectedIndex} boxWidth={boxWidth} />
      ))}
    </Box>
  );
}
