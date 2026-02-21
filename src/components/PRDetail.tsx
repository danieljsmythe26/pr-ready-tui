import React from 'react';
import { Box, Text } from 'ink';
import type { PR } from '../types.js';

interface PRDetailProps {
  pr: PR;
  boxWidth: number;
}

function ciStatusColor(conclusion: string | null): string {
  if (conclusion === 'SUCCESS' || conclusion === 'NEUTRAL' || conclusion === 'SKIPPED') return 'green';
  if (conclusion === 'FAILURE' || conclusion === 'CANCELLED' || conclusion === 'TIMED_OUT') return 'red';
  return 'yellow';
}

function ciStatusIcon(conclusion: string | null): string {
  if (conclusion === 'SUCCESS') return 'P';
  if (conclusion === 'FAILURE') return 'X';
  if (conclusion === 'NEUTRAL' || conclusion === 'SKIPPED') return '-';
  return '~';
}

export function PRDetail({ pr, boxWidth }: PRDetailProps) {
  const innerWidth = boxWidth - 2;
  const b = pr.scoreBreakdown;

  return (
    <Box flexDirection="column">
      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>

      {/* Title */}
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text bold color="cyan">{'#'}{pr.number}</Text>
        <Text bold>{' '}{pr.title.slice(0, innerWidth - 10)}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 4 - String(pr.number).length - pr.title.slice(0, innerWidth - 10).length)) + '│'}</Text>
      </Text>

      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>

      {/* Metadata */}
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text dimColor>{'repo: '}</Text><Text>{pr.repo.owner}/{pr.repo.repo}</Text>
        <Text dimColor>{'  branch: '}</Text><Text color="magenta">{pr.headRefName.slice(0, 30)}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, 5)) + '│'}</Text>
      </Text>
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text dimColor>{'author: '}</Text><Text>{pr.author}</Text>
        <Text dimColor>{'  +{0} -{1} files:{2}'.replace('{0}', String(pr.additions)).replace('{1}', String(pr.deletions)).replace('{2}', String(pr.changedFiles))}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, 5)) + '│'}</Text>
      </Text>

      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>

      {/* Score breakdown */}
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text bold>{'Score: '}</Text>
        <Text bold color={pr.score >= 80 ? 'green' : pr.score >= 50 ? 'yellow' : 'red'}>{pr.score}</Text>
        <Text dimColor>{'/100'}</Text>
        <Text dimColor>{'  ['}</Text>
        <Text dimColor>{'CI:'}</Text><Text color={b.ci >= 20 ? 'green' : b.ci > 0 ? 'yellow' : 'red'}>{b.ci}</Text>
        <Text dimColor>{' Rev:'}</Text><Text color={b.reviews >= 20 ? 'green' : b.reviews > 0 ? 'yellow' : 'red'}>{b.reviews}</Text>
        <Text dimColor>{' Merge:'}</Text><Text color={b.conflicts >= 15 ? 'green' : b.conflicts > 0 ? 'yellow' : 'red'}>{b.conflicts}</Text>
        <Text dimColor>{' Fresh:'}</Text><Text color={b.staleness >= 15 ? 'green' : b.staleness > 0 ? 'yellow' : 'red'}>{b.staleness}</Text>
        <Text dimColor>{']'}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, 5)) + '│'}</Text>
      </Text>

      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>

      {/* CI Checks */}
      {pr.statusCheckRollup.length > 0 && (
        <Box flexDirection="column">
          <Text>
            <Text dimColor>{'│  '}</Text>
            <Text bold>{'CI Checks:'}</Text>
            <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 12)) + '│'}</Text>
          </Text>
          {pr.statusCheckRollup.slice(0, 10).map((check, i) => (
            <Text key={i}>
              <Text dimColor>{'│    '}</Text>
              <Text color={ciStatusColor(check.conclusion)}>{ciStatusIcon(check.conclusion)}</Text>
              <Text>{' '}{check.name.slice(0, innerWidth - 10)}</Text>
              <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 6 - check.name.slice(0, innerWidth - 10).length)) + '│'}</Text>
            </Text>
          ))}
          {pr.statusCheckRollup.length > 10 && (
            <Text>
              <Text dimColor>{'│    '}</Text>
              <Text dimColor>{'... and '}{pr.statusCheckRollup.length - 10}{' more'}</Text>
              <Text dimColor>{' '.repeat(Math.max(1, 5)) + '│'}</Text>
            </Text>
          )}
        </Box>
      )}

      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>

      {/* Labels */}
      {pr.labels.length > 0 && (
        <Text>
          <Text dimColor>{'│  '}</Text>
          <Text dimColor>{'labels: '}</Text>
          <Text color="magenta">{pr.labels.join(', ')}</Text>
          <Text dimColor>{' '.repeat(Math.max(1, 5)) + '│'}</Text>
        </Text>
      )}

      {/* URL */}
      <Text>
        <Text dimColor>{'│  '}</Text>
        <Text dimColor>{pr.url}</Text>
        <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 2 - pr.url.length)) + '│'}</Text>
      </Text>

      <Text dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>
    </Box>
  );
}
