import React from 'react';
import { Box, Text } from 'ink';
import type { PR } from '../types.js';

interface PRDetailProps {
  pr: PR;
  boxWidth: number;
  scrollOffset: number;
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

function pad(text: string, innerWidth: number, leftPad: number = 2): string {
  const remaining = innerWidth - leftPad - text.length;
  return ' '.repeat(Math.max(1, remaining));
}

function line(innerWidth: number, left: string, content: React.ReactNode): React.ReactElement {
  // Helper not used directly — we'll just use pad() inline
  return <Text>{content}</Text>;
}

export function PRDetail({ pr, boxWidth, scrollOffset }: PRDetailProps) {
  if (!pr) {
    return <Text color="red">No PR selected</Text>;
  }
  const innerWidth = boxWidth - 2;
  const b = pr.scoreBreakdown ?? { ci: 0, reviews: 0, conflicts: 0, staleness: 0, total: 0 };

  // Build all lines as an array, then slice for scrolling
  const lines: React.ReactElement[] = [];

  // Blank
  lines.push(<Text key="s0" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

  // Title
  const titleText = `#${pr.number} ${pr.title.slice(0, innerWidth - 10)}`;
  lines.push(
    <Text key="title">
      <Text dimColor>{'│  '}</Text>
      <Text bold color="cyan">{'#'}{pr.number}</Text>
      <Text bold>{' '}{pr.title.slice(0, innerWidth - 10)}</Text>
      <Text dimColor>{pad(titleText, innerWidth) + '│'}</Text>
    </Text>
  );

  lines.push(<Text key="s1" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

  // Metadata
  const repoText = `repo: ${pr.repo.owner}/${pr.repo.repo}  branch: ${pr.headRefName.slice(0, 30)}`;
  lines.push(
    <Text key="meta1">
      <Text dimColor>{'│  '}</Text>
      <Text dimColor>{'repo: '}</Text><Text>{pr.repo.owner}/{pr.repo.repo}</Text>
      <Text dimColor>{'  branch: '}</Text><Text color="magenta">{pr.headRefName.slice(0, 30)}</Text>
      <Text dimColor>{pad(repoText, innerWidth) + '│'}</Text>
    </Text>
  );

  const authorText = `author: ${pr.author}  +${pr.additions} -${pr.deletions} files:${pr.changedFiles}`;
  lines.push(
    <Text key="meta2">
      <Text dimColor>{'│  '}</Text>
      <Text dimColor>{'author: '}</Text><Text>{pr.author}</Text>
      <Text dimColor>{`  +${pr.additions} -${pr.deletions} files:${pr.changedFiles}`}</Text>
      <Text dimColor>{pad(authorText, innerWidth) + '│'}</Text>
    </Text>
  );

  lines.push(<Text key="s2" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

  // Score breakdown
  const scoreText = `Score: ${pr.score}/100  [CI:${b.ci} Rev:${b.reviews} Merge:${b.conflicts} Fresh:${b.staleness}]`;
  lines.push(
    <Text key="score">
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
      <Text dimColor>{pad(scoreText, innerWidth) + '│'}</Text>
    </Text>
  );

  lines.push(<Text key="s3" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

  // CI Checks
  const checks = pr.statusCheckRollup ?? [];
  if (checks.length > 0) {
    const ciHeader = 'CI Checks:';
    lines.push(
      <Text key="ci-header">
        <Text dimColor>{'│  '}</Text>
        <Text bold>{ciHeader}</Text>
        <Text dimColor>{pad(ciHeader, innerWidth) + '│'}</Text>
      </Text>
    );
    checks.filter(c => c.name).slice(0, 10).forEach((check, i) => {
      const checkText = `  ${ciStatusIcon(check.conclusion)} ${(check.name ?? '').slice(0, innerWidth - 10)}`;
      lines.push(
        <Text key={`ci-${i}`}>
          <Text dimColor>{'│    '}</Text>
          <Text color={ciStatusColor(check.conclusion)}>{ciStatusIcon(check.conclusion)}</Text>
          <Text>{' '}{(check.name ?? 'unknown').slice(0, innerWidth - 10)}</Text>
          <Text dimColor>{pad(checkText, innerWidth, 4) + '│'}</Text>
        </Text>
      );
    });
    if (checks.length > 10) {
      const moreText = `... and ${checks.length - 10} more`;
      lines.push(
        <Text key="ci-more">
          <Text dimColor>{'│    '}</Text>
          <Text dimColor>{moreText}</Text>
          <Text dimColor>{pad(moreText, innerWidth, 4) + '│'}</Text>
        </Text>
      );
    }
    lines.push(<Text key="s4" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);
  }

  // Review Comments
  const comments = pr.reviewComments ?? [];
  if (comments.length > 0) {
    const rcHeader = `Review Comments (${pr.reviewComments.length}):`;
    lines.push(
      <Text key="rc-header">
        <Text dimColor>{'│  '}</Text>
        <Text bold color="yellow">{rcHeader}</Text>
        <Text dimColor>{pad(rcHeader, innerWidth) + '│'}</Text>
      </Text>
    );
    lines.push(<Text key="s5" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

    comments.forEach((comment, i) => {
      // File path + author
      const headerText = `${comment.author} on ${comment.path}${comment.line ? `:${comment.line}` : ''}`;
      lines.push(
        <Text key={`rc-h-${i}`}>
          <Text dimColor>{'│    '}</Text>
          <Text color="cyan" bold>{comment.author}</Text>
          <Text dimColor>{' on '}</Text>
          <Text color="magenta">{comment.path}{comment.line ? `:${comment.line}` : ''}</Text>
          <Text dimColor>{pad(headerText, innerWidth, 4) + '│'}</Text>
        </Text>
      );

      // Comment body — wrap to fit
      const maxBodyWidth = innerWidth - 8;
      const bodyLines = comment.body.split('\n').slice(0, 8); // Limit to 8 lines per comment
      bodyLines.forEach((bl, j) => {
        const truncated = bl.slice(0, maxBodyWidth);
        lines.push(
          <Text key={`rc-b-${i}-${j}`}>
            <Text dimColor>{'│      '}</Text>
            <Text>{truncated}</Text>
            <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 6 - truncated.length)) + '│'}</Text>
          </Text>
        );
      });
      if (comment.body.split('\n').length > 8) {
        lines.push(
          <Text key={`rc-more-${i}`}>
            <Text dimColor>{'│      '}</Text>
            <Text dimColor>{'...'}</Text>
            <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 9)) + '│'}</Text>
          </Text>
        );
      }

      // Separator between comments
      if (i < comments.length - 1) {
        lines.push(<Text key={`rc-sep-${i}`} dimColor>{'│    ' + '·'.repeat(innerWidth - 8) + '    │'}</Text>);
      }
    });
    lines.push(<Text key="s6" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);
  }

  // Review Verdict (if agent has run)
  if (pr.reviewVerdict) {
    const verdictHeader = 'Agent Review Verdict:';
    lines.push(
      <Text key="verdict-header">
        <Text dimColor>{'│  '}</Text>
        <Text bold color="green">{verdictHeader}</Text>
        <Text dimColor>{pad(verdictHeader, innerWidth) + '│'}</Text>
      </Text>
    );
    const verdictLines = pr.reviewVerdict.split('\n').slice(0, 20);
    verdictLines.forEach((vl, i) => {
      const truncated = vl.slice(0, innerWidth - 6);
      lines.push(
        <Text key={`verdict-${i}`}>
          <Text dimColor>{'│    '}</Text>
          <Text>{truncated}</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 4 - truncated.length)) + '│'}</Text>
        </Text>
      );
    });
    lines.push(<Text key="s7" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);
  }

  // Labels
  if (pr.labels.length > 0) {
    const labelText = `labels: ${pr.labels.join(', ')}`;
    lines.push(
      <Text key="labels">
        <Text dimColor>{'│  '}</Text>
        <Text dimColor>{'labels: '}</Text>
        <Text color="magenta">{pr.labels.join(', ')}</Text>
        <Text dimColor>{pad(labelText, innerWidth) + '│'}</Text>
      </Text>
    );
  }

  // URL
  lines.push(
    <Text key="url">
      <Text dimColor>{'│  '}</Text>
      <Text dimColor>{pr.url}</Text>
      <Text dimColor>{pad(pr.url, innerWidth) + '│'}</Text>
    </Text>
  );

  lines.push(<Text key="s-end" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

  // Scroll indicator
  const VIEWPORT = 20;
  const totalLines = lines.length;
  const visibleLines = lines.slice(scrollOffset, scrollOffset + VIEWPORT);
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + VIEWPORT < totalLines;

  return (
    <Box flexDirection="column">
      {canScrollUp && (
        <Text dimColor>{'│' + ' '.repeat((innerWidth - 5) / 2) + '▲ ▲ ▲' + ' '.repeat(Math.max(1, innerWidth - (innerWidth - 5) / 2 - 5)) + '│'}</Text>
      )}
      {visibleLines}
      {canScrollDown && (
        <Text dimColor>{'│' + ' '.repeat(Math.floor((innerWidth - 5) / 2)) + '▼ ▼ ▼' + ' '.repeat(Math.max(1, Math.ceil((innerWidth - 5) / 2))) + '│'}</Text>
      )}
    </Box>
  );
}
