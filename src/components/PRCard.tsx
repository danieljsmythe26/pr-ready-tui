import React from 'react';
import { Text } from 'ink';
import type { PR } from '../types.js';

interface PRCardProps {
  pr: PR;
  selected: boolean;
  boxWidth: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

function ciIcon(pr: PR): string {
  const checks = pr.statusCheckRollup;
  if (checks.length === 0) return '-';
  if (checks.every(c => c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL' || c.conclusion === 'SKIPPED')) return 'P';
  if (checks.some(c => c.conclusion === 'FAILURE' || c.conclusion === 'CANCELLED' || c.conclusion === 'TIMED_OUT' || c.conclusion === 'ACTION_REQUIRED')) return 'X';
  return '~';
}

function reviewIcon(decision: string): string {
  switch (decision) {
    case 'APPROVED': return 'A';
    case 'CHANGES_REQUESTED': return 'C';
    case 'REVIEW_REQUIRED': return 'R';
    default: return '-';
  }
}

function mergeIcon(mergeable: string): string {
  switch (mergeable) {
    case 'MERGEABLE': return 'M';
    case 'CONFLICTING': return '!';
    default: return '?';
  }
}

export function PRCard({ pr, selected, boxWidth }: PRCardProps) {
  const innerWidth = boxWidth - 2;
  const scoreStr = String(pr.score).padStart(3);
  const repoShort = pr.repo.repo.slice(0, 12).padEnd(12);
  const ci = ciIcon(pr);
  const review = reviewIcon(pr.reviewDecision);
  const merge = mergeIcon(pr.mergeable);
  const author = pr.author.slice(0, 12).padEnd(12);
  const indicators = `${ci} ${review} ${merge}`;
  // score(3) + space(1) + repo(12) + space(1) + #num(5) + space(1) + author(12) + space(1) + indicators(5) = 41
  const metaLen = 3 + 1 + 12 + 1 + 5 + 1 + 12 + 1 + 5;
  const titleMax = innerWidth - metaLen - 4; // 4 for padding/borders
  const title = pr.title.length > titleMax ? pr.title.slice(0, titleMax - 1) + '~' : pr.title.padEnd(titleMax);

  const prefix = selected ? '> ' : '  ';

  return (
    <Text>
      <Text dimColor>{'│'}</Text>
      {selected
        ? <Text color="cyan" bold>{prefix}</Text>
        : <Text>{prefix}</Text>
      }
      <Text color={scoreColor(pr.score)} bold>{scoreStr}</Text>
      <Text> </Text>
      <Text dimColor>{repoShort}</Text>
      <Text> </Text>
      <Text dimColor>{'#'}{String(pr.number).padEnd(4)}</Text>
      <Text> </Text>
      <Text>{title}</Text>
      <Text> </Text>
      <Text dimColor>{author}</Text>
      <Text> </Text>
      <Text color={ci === 'P' ? 'green' : ci === 'X' ? 'red' : 'yellow'}>{ci}</Text>
      <Text> </Text>
      <Text color={review === 'A' ? 'green' : review === 'C' ? 'red' : 'yellow'}>{review}</Text>
      <Text> </Text>
      <Text color={merge === 'M' ? 'green' : merge === '!' ? 'red' : 'yellow'}>{merge}</Text>
      <Text dimColor>{'│'}</Text>
    </Text>
  );
}
