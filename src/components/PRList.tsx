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
  condensed?: boolean;
}

export function PRList({ prs, selectedIndex, loading, error, boxWidth, condensed }: PRListProps) {
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

  if (error && prs.length === 0) {
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

  if (!error && prs.length === 0) {
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
  const headerLine = condensed
    ? '  SCR REPO         #     TITLE' + ' '.repeat(Math.max(1, innerWidth - 40)) + 'AGE CI R M'
    : '  SCR REPO         #     TITLE' + ' '.repeat(Math.max(1, innerWidth - 53)) + 'AUTHOR       AGE CI R M';

  // Truncate error to fit in a banner line
  // account for "│  " (3) + "[!] " (4) prefix and " │" (2) suffix = 9
  const bannerMaxLen = innerWidth - 9;
  const truncatedError = error && error.length > bannerMaxLen
    ? error.slice(0, bannerMaxLen - 1) + '…'
    : error;

  return (
    <Box flexDirection="column">
      {error && (
        <>
          <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
          <Text>
            <Text dimColor>{'│  '}</Text>
            <Text color="yellow">{'[!] '}{truncatedError}</Text>
            <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 7 - (truncatedError?.length ?? 0))) + '│'}</Text>
          </Text>
        </>
      )}
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      <Text>
        <Text dimColor>{'│'}</Text>
        <Text dimColor>{headerLine.slice(0, innerWidth)}</Text>
        <Text dimColor>{'│'}</Text>
      </Text>
      <Text dimColor>{'│' + '─'.repeat(innerWidth) + '│'}</Text>
      {prs.map((pr, i) => (
        <PRCard key={`${pr.repo.repo}-${pr.number}`} pr={pr} selected={i === selectedIndex} boxWidth={boxWidth} condensed={condensed} />
      ))}
    </Box>
  );
}
