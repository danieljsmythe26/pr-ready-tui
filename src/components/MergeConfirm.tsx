import React from 'react';
import { Box, Text } from 'ink';
import type { PR } from '../types.js';

interface MergeConfirmProps {
  pr: PR;
  boxWidth: number;
}

export function MergeConfirm({ pr, boxWidth }: MergeConfirmProps) {
  const innerWidth = boxWidth - 2;

  return (
    <Box flexDirection="column">
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text bold color="red">{'Merge PR?'}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 11)) + '│'}</Text>
      </Text>
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text>{'#'}{pr.number} </Text>
        <Text bold>{pr.title.slice(0, innerWidth - 15)}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, 3)) + '│'}</Text>
      </Text>
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text dimColor>{pr.headRefName}</Text>
        <Text dimColor>{' → '}</Text>
        <Text>{pr.baseRefName}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 5 - pr.headRefName.length - pr.baseRefName.length)) + '│'}</Text>
      </Text>
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text color="green" bold>{'[y]'}</Text>
        <Text>{' confirm merge  '}</Text>
        <Text color="red" bold>{'[n/Esc]'}</Text>
        <Text>{' cancel'}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 34)) + '│'}</Text>
      </Text>
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
    </Box>
  );
}
