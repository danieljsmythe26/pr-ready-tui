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
  groupByRepo?: boolean;
}

function blankLine(innerWidth: number, key: React.Key) {
  return <Text key={key} dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>;
}

function fillLines(innerWidth: number, count: number, keyPrefix: string) {
  return Array.from({ length: Math.max(0, count) }, (_, i) => blankLine(innerWidth, `${keyPrefix}-${i}`));
}

type ListItem =
  | { type: 'header'; repo: string }
  | { type: 'pr'; pr: PR; prIndex: number };

function repoKey(pr: PR): string {
  return `${pr.repo.owner}/${pr.repo.repo}`;
}

function buildItems(prs: PR[], groupByRepo: boolean): ListItem[] {
  if (!groupByRepo) {
    return prs.map((pr, prIndex) => ({ type: 'pr', pr, prIndex }));
  }

  const byRepo = new Map<string, Array<{ pr: PR; prIndex: number }>>();
  prs.forEach((pr, prIndex) => {
    const key = repoKey(pr);
    const group = byRepo.get(key) ?? [];
    group.push({ pr, prIndex });
    byRepo.set(key, group);
  });

  return Array.from(byRepo.entries()).flatMap(([repo, group]) => [
    { type: 'header' as const, repo },
    ...group.map(({ pr, prIndex }) => ({ type: 'pr' as const, pr, prIndex })),
  ]);
}

function renderGroupHeader(repo: string, innerWidth: number) {
  const label = ` ${repo} `;
  const pad = Math.max(0, innerWidth - label.length);
  return (
    <Text key={`repo-${repo}`}>
      <Text dimColor>{'│'}</Text>
      <Text bold color="cyan">{label}</Text>
      <Text dimColor>{' '.repeat(pad)}</Text>
      <Text dimColor>{'│'}</Text>
    </Text>
  );
}

export function PRList({ prs, selectedIndex, loading, error, boxWidth, height, condensed, groupByRepo = false }: PRListProps) {
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
    ? '  SCR REPO         #     TITLE' + ' '.repeat(Math.max(1, innerWidth - 44)) + 'AGE CI R M LOC'
    : '  SCR REPO         #     TITLE' + ' '.repeat(Math.max(1, innerWidth - 57)) + 'AUTHOR       AGE CI R M LOC';

  // Truncate error to fit in a banner line
  // account for "│  " (3) + "[!] " (4) prefix and " │" (2) suffix = 9
  const bannerMaxLen = Math.max(0, innerWidth - 9);
  const truncatedError = error && bannerMaxLen > 0 && error.length > bannerMaxLen
    ? error.slice(0, bannerMaxLen - 1) + '…'
    : error;
  const staticLines = (error ? 2 : 0) + 3;
  const items = buildItems(prs, groupByRepo);
  const visibleRows = Math.max(0, (height ?? staticLines + items.length) - staticLines);
  const selectedItemIndex = Math.max(0, items.findIndex(item => item.type === 'pr' && item.prIndex === selectedIndex));
  const windowStart = selectedItemIndex >= visibleRows
    ? Math.max(0, selectedItemIndex - visibleRows + 1)
    : 0;
  const visibleItems = items.slice(windowStart, windowStart + visibleRows);

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
      {visibleItems.map(item => (
        item.type === 'header'
          ? renderGroupHeader(item.repo, innerWidth)
          : <PRCard key={`${repoKey(item.pr)}-${item.pr.number}`} pr={item.pr} selected={item.prIndex === selectedIndex} boxWidth={boxWidth} condensed={condensed} />
      ))}
      {fillLines(innerWidth, visibleRows - visibleItems.length, 'pr-fill')}
    </Box>
  );
}
