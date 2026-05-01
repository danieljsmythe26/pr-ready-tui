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
  height?: number;
  condensed?: boolean;
}

function blankLine(innerWidth: number, key: React.Key) {
  return <Text key={key} dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>;
}

function fillLines(innerWidth: number, count: number, keyPrefix: string) {
  return Array.from({ length: Math.max(0, count) }, (_, i) => blankLine(innerWidth, `${keyPrefix}-${i}`));
}

export function PRList({ prs, selectedIndex, loading, error, boxWidth, height, condensed }: PRListProps) {
  const innerWidth = boxWidth - 2;

  if (loading && prs.length === 0) {
    const usedLines = 3;
    return (
      <Box flexDirection="column">
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
        <Text>
          <Text dimColor>{'│  '}</Text>
          <Text color="yellow">Loading PRs...</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 2 - 14)) + '│'}</Text>
        </Text>
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
        {fillLines(innerWidth, (height ?? usedLines) - usedLines, 'loading-fill')}
      </Box>
    );
  }

  if (error && prs.length === 0) {
    const usedLines = 3;
    return (
      <Box flexDirection="column">
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
        <Text>
          <Text dimColor>{'│  '}</Text>
          <Text color="red">Error: {error}</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 2 - 7 - error.length)) + '│'}</Text>
        </Text>
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
        {fillLines(innerWidth, (height ?? usedLines) - usedLines, 'error-fill')}
      </Box>
    );
  }

  if (!error && prs.length === 0) {
    const usedLines = 3;
    return (
      <Box flexDirection="column">
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
        <Text>
          <Text dimColor>{'│  '}</Text>
          <Text color="green">No open PRs found.</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 2 - 19)) + '│'}</Text>
        </Text>
        <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
        {fillLines(innerWidth, (height ?? usedLines) - usedLines, 'empty-fill')}
      </Box>
    );
  }

  // Column headers
  const headerLine = condensed
    ? '  SCR REPO         #     TITLE' + ' '.repeat(Math.max(1, innerWidth - 40)) + 'AGE CI R M'
    : '  SCR REPO         #     TITLE' + ' '.repeat(Math.max(1, innerWidth - 53)) + 'AUTHOR       AGE CI R M';

  // Truncate error to fit in a banner line
  // account for "│  " (3) + "[!] " (4) prefix and " │" (2) suffix = 9
  const bannerMaxLen = Math.max(0, innerWidth - 9);
  const truncatedError = error && bannerMaxLen > 0 && error.length > bannerMaxLen
    ? error.slice(0, bannerMaxLen - 1) + '…'
    : error;
  const staticLines = (error ? 2 : 0) + 3;
  const visibleRows = Math.max(0, (height ?? staticLines + prs.length) - staticLines);
  const windowStart = selectedIndex >= visibleRows
    ? Math.max(0, selectedIndex - visibleRows + 1)
    : 0;
  const visiblePRs = prs.slice(windowStart, windowStart + visibleRows);

  return (
    <Box flexDirection="column">
      {error && (
        <>
          <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
          <Text>
            <Text dimColor>{'│  '}</Text>
            <Text color="yellow">{'[!] '}{truncatedError}</Text>
            <Text dimColor>{' '.repeat(Math.max(0, innerWidth - 7 - (truncatedError?.length ?? 0))) + '│'}</Text>
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
      {visiblePRs.map((pr, i) => (
        <PRCard key={`${pr.repo.repo}-${pr.number}`} pr={pr} selected={windowStart + i === selectedIndex} boxWidth={boxWidth} condensed={condensed} />
      ))}
      {fillLines(innerWidth, visibleRows - visiblePRs.length, 'pr-fill')}
    </Box>
  );
}
