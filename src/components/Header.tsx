import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  totalPRs: number;
  hideBots: boolean;
  loading: boolean;
  boxWidth: number;
  sortBy?: string;
  repoFilter?: string | null;
  splitAt?: number | undefined;
}

export function Header({ totalPRs, hideBots, loading, boxWidth, sortBy, repoFilter, splitAt }: HeaderProps) {
  const innerWidth = boxWidth - 2;
  const title = ' pr-ready-tui ';
  const sortLabel = sortBy ? ` ▾${sortBy}` : '';
  const filterLabel = repoFilter ? ` [${repoFilter}]` : '';
  const info = `${totalPRs} PRs${hideBots ? ' (bots hidden)' : ''}${sortLabel}${filterLabel}${loading ? ' ...' : ''}`;

  if (splitAt) {
    // Two-pane header: ┌─ title ─...─┬─ info ─┐
    const leftInner = splitAt - 2; // inside left pane
    const rightInner = innerWidth - leftInner - 1; // -1 for the ┬
    const leftPad = leftInner - 1 - title.length;
    const rightPad = rightInner - info.length - 2;
    return (
      <Box flexDirection="column">
        <Text>
          <Text dimColor>{'┌─'}</Text>
          <Text bold color="cyan">{title}</Text>
          <Text dimColor>{'─'.repeat(Math.max(1, leftPad))}</Text>
          <Text dimColor>{'┬'}</Text>
          <Text dimColor>{'─'.repeat(Math.max(1, rightPad))}</Text>
          <Text dimColor>{' '}{info}{' '}</Text>
          <Text dimColor>{'┐'}</Text>
        </Text>
      </Box>
    );
  }

  const pad = innerWidth - 1 - title.length - info.length - 2;

  return (
    <Box flexDirection="column">
      <Text>
        <Text dimColor>{'┌─'}</Text>
        <Text bold color="cyan">{title}</Text>
        <Text dimColor>{'─'.repeat(Math.max(1, pad))}</Text>
        <Text dimColor>{' '}{info}{' '}</Text>
        <Text dimColor>{'┐'}</Text>
      </Text>
    </Box>
  );
}
