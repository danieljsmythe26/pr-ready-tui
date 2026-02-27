import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  totalPRs: number;
  hideBots: boolean;
  loading: boolean;
  boxWidth: number;
}

export function Header({ totalPRs, hideBots, loading, boxWidth }: HeaderProps) {
  const innerWidth = boxWidth - 2;
  const title = ' pr-ready-tui ';
  const info = `${totalPRs} PRs${hideBots ? ' (bots hidden)' : ''}${loading ? ' ...' : ''}`;
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
