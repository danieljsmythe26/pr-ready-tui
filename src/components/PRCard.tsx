import React from 'react';
import { Text } from 'ink';
import stringWidth from 'string-width';
import cliTruncate from 'cli-truncate';
import type { LocalPRMarker, PR } from '../types.js';

interface PRCardProps {
  pr: PR;
  selected: boolean;
  boxWidth: number;
  condensed?: boolean | undefined;
}

function formatAge(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}m`;
}

function ageColor(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = ms / 86_400_000;
  if (days < 1) return 'green';
  if (days <= 7) return 'yellow';
  return 'red';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

function ciIcon(pr: PR): string {
  const checks = pr.statusCheckRollup;
  if (checks.length === 0) return '·';
  if (checks.every(c => c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL' || c.conclusion === 'SKIPPED')) return '✓';
  if (checks.some(c => c.conclusion === 'FAILURE' || c.conclusion === 'CANCELLED' || c.conclusion === 'TIMED_OUT' || c.conclusion === 'ACTION_REQUIRED')) return '✗';
  return '○';
}

function reviewIcon(decision: string): string {
  switch (decision) {
    case 'APPROVED': return '✓';
    case 'CHANGES_REQUESTED': return '✗';
    case 'REVIEW_REQUIRED': return '○';
    default: return '·';
  }
}

function mergeIcon(mergeable: string): string {
  switch (mergeable) {
    case 'MERGEABLE': return '✓';
    case 'CONFLICTING': return '✗';
    default: return '○';
  }
}

function localMarker(pr: PR): LocalPRMarker {
  return pr.localState?.marker ?? '-';
}

function localColor(marker: LocalPRMarker): string {
  if (marker === 'W') return 'green';
  if (marker === 'W*' || marker === 'L↓' || marker === 'L↕') return 'yellow';
  if (marker === 'L↑') return 'magenta';
  if (marker === 'L') return 'cyan';
  return 'gray';
}

function isLocalBold(marker: LocalPRMarker): boolean {
  return marker === 'W*' || marker === 'L↑' || marker === 'L↓' || marker === 'L↕';
}

export function PRCard({ pr, selected, boxWidth, condensed }: PRCardProps) {
  const innerWidth = boxWidth - 2;
  const scoreStr = String(pr.score).padStart(3);
  const repoShort = pr.repo.repo.slice(0, 12).padEnd(12);
  const numberStr = `#${String(pr.number).padEnd(4)}`;
  const loc = localMarker(pr);
  const locStr = loc.padEnd(2);
  const ci = ciIcon(pr);
  const review = reviewIcon(pr.reviewDecision);
  const merge = mergeIcon(pr.mergeable);
  const author = condensed ? '' : pr.author.slice(0, 12).padEnd(12);
  const age = formatAge(pr.updatedAt).padStart(3);
  // Full: score(3)+sp+repo(12)+sp+#(5)+sp+author(12)+sp+age(3)+sp+indicators(5) = 45
  // Condensed: no author = 45 - 13 = 32
  const metaLen = condensed
    ? 3 + 1 + 12 + 1 + 5 + 1 + 3 + 1 + 5 + 1 + 2
    : 3 + 1 + 12 + 1 + 5 + 1 + 12 + 1 + 3 + 1 + 5 + 1 + 2;
  const draftTag = pr.isDraft ? 'DRAFT ' : '';
  const titleMax = innerWidth - metaLen - 4 - draftTag.length; // 4 for padding/borders
  const truncTitle = pr.title.length > titleMax ? pr.title.slice(0, titleMax - 1) + '~' : pr.title.padEnd(titleMax);
  const title = draftTag + truncTitle;

  const prefix = selected ? '\u258C ' : '  ';

  const authorPart = condensed ? '' : ` ${author}`;
  const rowText = `${prefix}${scoreStr} ${repoShort} ${numberStr} ${title}${authorPart} ${age} ${ci} ${review} ${merge} ${locStr}`;
  const rowWidth = stringWidth(rowText);
  const trailingPad = rowWidth < innerWidth ? ' '.repeat(innerWidth - rowWidth) : '';

  // Selected row: inverted background (white bg, black text) like lazygit
  if (selected) {
    if (rowWidth > innerWidth) {
      const padded = cliTruncate(rowText, innerWidth, { truncationCharacter: '' });
      return (
        <Text>
          <Text dimColor>{'│'}</Text>
          <Text backgroundColor="white" color="black" bold>{padded}</Text>
          <Text dimColor>{'│'}</Text>
        </Text>
      );
    }

    return (
      <Text>
        <Text dimColor>{'│'}</Text>
        <Text backgroundColor="white" color="black" bold>{prefix}</Text>
        <Text backgroundColor="white" color="black" bold>{scoreStr}</Text>
        <Text backgroundColor="white" color="black" bold> </Text>
        <Text backgroundColor="white" color={localColor(loc)} bold>{repoShort}</Text>
        <Text backgroundColor="white" color="black" bold> </Text>
        <Text backgroundColor="white" color={localColor(loc)} bold>{numberStr}</Text>
        <Text backgroundColor="white" color="black" bold> </Text>
        <Text backgroundColor="white" color="black" bold>{title}</Text>
        {!condensed && <Text backgroundColor="white" color="black" bold> </Text>}
        {!condensed && <Text backgroundColor="white" color="black" bold>{author}</Text>}
        <Text backgroundColor="white" color="black" bold> </Text>
        <Text backgroundColor="white" color="black" bold>{age}</Text>
        <Text backgroundColor="white" color="black" bold> </Text>
        <Text backgroundColor="white" color="black" bold>{ci}</Text>
        <Text backgroundColor="white" color="black" bold> </Text>
        <Text backgroundColor="white" color="black" bold>{review}</Text>
        <Text backgroundColor="white" color="black" bold> </Text>
        <Text backgroundColor="white" color="black" bold>{merge}</Text>
        <Text backgroundColor="white" color="black" bold> </Text>
        <Text backgroundColor="white" color={localColor(loc)} bold>{locStr}</Text>
        <Text backgroundColor="white" color="black" bold>{trailingPad}</Text>
        <Text dimColor>{'│'}</Text>
      </Text>
    );
  }

  // Calculate total content width of unselected row to pad to innerWidth
  return (
    <Text>
      <Text dimColor>{'│'}</Text>
      <Text>{prefix}</Text>
      <Text color={scoreColor(pr.score)} bold>{scoreStr}</Text>
      <Text> </Text>
      <Text color={localColor(loc)} bold={isLocalBold(loc)} dimColor={loc === '-'}>{repoShort}</Text>
      <Text> </Text>
      <Text color={localColor(loc)} bold={isLocalBold(loc)} dimColor={loc === '-'}>{numberStr}</Text>
      <Text> </Text>
      {pr.isDraft && <Text color="yellow" dimColor>{'DRAFT '}</Text>}
      <Text>{truncTitle}</Text>
      {!condensed && <Text> </Text>}
      {!condensed && <Text dimColor>{author}</Text>}
      <Text> </Text>
      <Text color={ageColor(pr.updatedAt)}>{age}</Text>
      <Text> </Text>
      <Text color={ci === '✓' ? 'green' : ci === '✗' ? 'red' : ci === '○' ? 'yellow' : 'gray'}>{ci}</Text>
      <Text> </Text>
      <Text color={review === '✓' ? 'green' : review === '✗' ? 'red' : review === '○' ? 'yellow' : 'gray'}>{review}</Text>
      <Text> </Text>
      <Text color={merge === '✓' ? 'green' : merge === '✗' ? 'red' : 'yellow'}>{merge}</Text>
      <Text> </Text>
      <Text color={localColor(loc)} bold={isLocalBold(loc)} dimColor={loc === '-'}>{locStr}</Text>
      <Text>{trailingPad}</Text>
      <Text dimColor>{'│'}</Text>
    </Text>
  );
}
