import React from 'react';
import { Box, Text } from 'ink';
import type { PR } from '../types.js';

interface PRDetailProps {
  pr: PR;
  boxWidth: number;
  scrollOffset: number;
  leftBorder?: boolean;
}

function ciStatusColor(conclusion: string | null): string {
  if (conclusion === 'SUCCESS' || conclusion === 'NEUTRAL' || conclusion === 'SKIPPED') return 'green';
  if (conclusion === 'FAILURE' || conclusion === 'CANCELLED' || conclusion === 'TIMED_OUT') return 'red';
  return 'yellow';
}

function ciStatusIcon(conclusion: string | null): string {
  if (conclusion === 'SUCCESS') return '✓';
  if (conclusion === 'FAILURE') return '✗';
  if (conclusion === 'NEUTRAL' || conclusion === 'SKIPPED') return '·';
  return '○';
}

function relativeTime(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

function pad(text: string, innerWidth: number, leftPad: number = 2): string {
  const remaining = innerWidth - leftPad - text.length;
  return ' '.repeat(Math.max(1, remaining));
}

export function PRDetail({ pr, boxWidth, scrollOffset, leftBorder = true }: PRDetailProps) {
  if (!pr) {
    return <Text color="red">No PR selected</Text>;
  }
  const innerWidth = boxWidth - 2;
  const b = pr.scoreBreakdown ?? { ci: 0, reviews: 0, conflicts: 0, staleness: 0, total: 0 };
  const lb = leftBorder ? '│' : ' ';

  // Build all lines as an array, then slice for scrolling
  const lines: React.ReactElement[] = [];

  // Blank
  lines.push(<Text key="s0" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);

  // Title
  const titleText = `#${pr.number} ${pr.title.slice(0, innerWidth - 10)}`;
  lines.push(
    <Text key="title">
      <Text dimColor>{lb + '  '}</Text>
      <Text bold color="cyan">{'#'}{pr.number}</Text>
      <Text bold>{' '}{pr.title.slice(0, innerWidth - 10)}</Text>
      <Text dimColor>{pad(titleText, innerWidth) + '│'}</Text>
    </Text>
  );

  lines.push(<Text key="s1" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);

  // Metadata
  const repoText = `repo: ${pr.repo.owner}/${pr.repo.repo}  branch: ${pr.headRefName.slice(0, 30)}`;
  lines.push(
    <Text key="meta1">
      <Text dimColor>{lb + '  '}</Text>
      <Text dimColor>{'repo: '}</Text><Text>{pr.repo.owner}/{pr.repo.repo}</Text>
      <Text dimColor>{'  branch: '}</Text><Text color="magenta">{pr.headRefName.slice(0, 30)}</Text>
      <Text dimColor>{pad(repoText, innerWidth) + '│'}</Text>
    </Text>
  );

  const authorText = `author: ${pr.author}  +${pr.additions} -${pr.deletions} files:${pr.changedFiles}`;
  lines.push(
    <Text key="meta2">
      <Text dimColor>{lb + '  '}</Text>
      <Text dimColor>{'author: '}</Text><Text>{pr.author}</Text>
      <Text dimColor>{`  +${pr.additions} -${pr.deletions} files:${pr.changedFiles}`}</Text>
      <Text dimColor>{pad(authorText, innerWidth) + '│'}</Text>
    </Text>
  );

  lines.push(<Text key="s2" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);

  // Score breakdown
  const scoreText = `Score: ${pr.score}/100  [CI:${b.ci} Rev:${b.reviews} Merge:${b.conflicts} Fresh:${b.staleness}]`;
  lines.push(
    <Text key="score">
      <Text dimColor>{lb + '  '}</Text>
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

  lines.push(<Text key="s3" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);

  // CI Checks
  const checks = pr.statusCheckRollup ?? [];
  if (checks.length > 0) {
    const ciHeader = 'CI Checks:';
    lines.push(
      <Text key="ci-header">
        <Text dimColor>{lb + '  '}</Text>
        <Text bold>{ciHeader}</Text>
        <Text dimColor>{pad(ciHeader, innerWidth) + '│'}</Text>
      </Text>
    );
    checks.filter(c => c.name).slice(0, 10).forEach((check, i) => {
      const checkText = `${ciStatusIcon(check.conclusion)} ${(check.name ?? 'unknown').slice(0, innerWidth - 10)}`;
      lines.push(
        <Text key={`ci-${i}`}>
          <Text dimColor>{lb + '   '}</Text>
          <Text color={ciStatusColor(check.conclusion)}>{ciStatusIcon(check.conclusion)}</Text>
          <Text>{' '}{(check.name ?? 'unknown').slice(0, innerWidth - 10)}</Text>
          <Text dimColor>{pad(checkText, innerWidth, 3) + '│'}</Text>
        </Text>
      );
    });
    if (checks.length > 10) {
      const moreText = `... and ${checks.length - 10} more`;
      lines.push(
        <Text key="ci-more">
          <Text dimColor>{lb + '   '}</Text>
          <Text dimColor>{moreText}</Text>
          <Text dimColor>{pad(moreText, innerWidth, 3) + '│'}</Text>
        </Text>
      );
    }
    lines.push(<Text key="s4" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);
  }

  // Review Comments (sorted newest-first)
  const comments = [...(pr.reviewComments ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (comments.length > 0) {
    const rcHeader = `Review Comments (${pr.reviewComments.length}):`;
    lines.push(
      <Text key="rc-header">
        <Text dimColor>{lb + '  '}</Text>
        <Text bold color="yellow">{rcHeader}</Text>
        <Text dimColor>{pad(rcHeader, innerWidth) + '│'}</Text>
      </Text>
    );
    lines.push(<Text key="s5" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);

    comments.forEach((comment, i) => {
      // File path + author + relative time
      const timeStr = relativeTime(comment.createdAt);
      const leftText = `${comment.author} on ${comment.path}${comment.line ? `:${comment.line}` : ''}`;
      const gap = Math.max(1, innerWidth - 3 - leftText.length - timeStr.length);
      lines.push(
        <Text key={`rc-h-${i}`}>
          <Text dimColor>{lb + '   '}</Text>
          <Text color="cyan" bold>{comment.author}</Text>
          <Text dimColor>{' on '}</Text>
          <Text color="magenta">{comment.path}{comment.line ? `:${comment.line}` : ''}</Text>
          <Text dimColor>{' '.repeat(gap)}</Text>
          <Text dimColor>{timeStr}</Text>
          <Text dimColor>{'│'}</Text>
        </Text>
      );

      // Comment body — wrap to fit
      const maxBodyWidth = innerWidth - 8;
      const bodyLines = comment.body.split('\n').slice(0, 8); // Limit to 8 lines per comment
      bodyLines.forEach((bl, j) => {
        const truncated = bl.slice(0, maxBodyWidth);
        lines.push(
          <Text key={`rc-b-${i}-${j}`}>
            <Text dimColor>{lb + '     '}</Text>
            <Text>{truncated}</Text>
            <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 5 - truncated.length)) + '│'}</Text>
          </Text>
        );
      });
      if (comment.body.split('\n').length > 8) {
        lines.push(
          <Text key={`rc-more-${i}`}>
            <Text dimColor>{lb + '     '}</Text>
            <Text dimColor>{'...'}</Text>
            <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 8)) + '│'}</Text>
          </Text>
        );
      }

      // Separator between comments
      if (i < comments.length - 1) {
        lines.push(<Text key={`rc-sep-${i}`} dimColor>{lb + '   ' + '·'.repeat(innerWidth - 7) + '   │'}</Text>);
      }
    });
    lines.push(<Text key="s6" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);
  }

  // Conversation Comments
  const convRaw = pr.conversationComments ?? '';
  if (convRaw.trim().length > 0) {
    const convBlocks = convRaw.split('\n---\n').filter(b => b.trim().length > 0);
    const ccHeader = `Conversation (${convBlocks.length}):`;
    lines.push(
      <Text key="cc-header">
        <Text dimColor>{lb + '  '}</Text>
        <Text bold color="cyan">{ccHeader}</Text>
        <Text dimColor>{pad(ccHeader, innerWidth) + '│'}</Text>
      </Text>
    );
    lines.push(<Text key="cc-s0" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);

    convBlocks.forEach((block, i) => {
      const blockLines = block.trim().split('\n');
      // First line is "author (date):"
      const headerLine = blockLines[0] ?? '';
      lines.push(
        <Text key={`cc-h-${i}`}>
          <Text dimColor>{lb + '   '}</Text>
          <Text color="cyan" bold>{headerLine.slice(0, innerWidth - 5)}</Text>
          <Text dimColor>{pad(headerLine, innerWidth, 3) + '│'}</Text>
        </Text>
      );
      // Remaining lines are the body
      const bodyLines = blockLines.slice(1).slice(0, 8);
      const maxBodyWidth = innerWidth - 8;
      bodyLines.forEach((bl, j) => {
        const truncated = bl.slice(0, maxBodyWidth);
        lines.push(
          <Text key={`cc-b-${i}-${j}`}>
            <Text dimColor>{lb + '     '}</Text>
            <Text>{truncated}</Text>
            <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 5 - truncated.length)) + '│'}</Text>
          </Text>
        );
      });
      if (blockLines.length > 9) {
        lines.push(
          <Text key={`cc-more-${i}`}>
            <Text dimColor>{lb + '     '}</Text>
            <Text dimColor>{'...'}</Text>
            <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 8)) + '│'}</Text>
          </Text>
        );
      }
      // Separator between comment blocks
      if (i < convBlocks.length - 1) {
        lines.push(<Text key={`cc-sep-${i}`} dimColor>{lb + '   ' + '·'.repeat(innerWidth - 7) + '   │'}</Text>);
      }
    });
    lines.push(<Text key="cc-end" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);
  }

  // Review Verdict (if agent has run)
  if (pr.reviewVerdict) {
    const verdictHeader = 'Agent Review Verdict:';
    lines.push(
      <Text key="verdict-header">
        <Text dimColor>{lb + '  '}</Text>
        <Text bold color="green">{verdictHeader}</Text>
        <Text dimColor>{pad(verdictHeader, innerWidth) + '│'}</Text>
      </Text>
    );
    const verdictLines = pr.reviewVerdict.split('\n').slice(0, 20);
    verdictLines.forEach((vl, i) => {
      const truncated = vl.slice(0, innerWidth - 6);
      lines.push(
        <Text key={`verdict-${i}`}>
          <Text dimColor>{lb + '   '}</Text>
          <Text>{truncated}</Text>
          <Text dimColor>{' '.repeat(Math.max(1, innerWidth - 3 - truncated.length)) + '│'}</Text>
        </Text>
      );
    });
    lines.push(<Text key="s7" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);
  }

  // Labels
  if (pr.labels.length > 0) {
    const labelText = `labels: ${pr.labels.join(', ')}`;
    lines.push(
      <Text key="labels">
        <Text dimColor>{lb + '  '}</Text>
        <Text dimColor>{'labels: '}</Text>
        <Text color="magenta">{pr.labels.join(', ')}</Text>
        <Text dimColor>{pad(labelText, innerWidth) + '│'}</Text>
      </Text>
    );
  }

  // URL
  lines.push(
    <Text key="url">
      <Text dimColor>{lb + '  '}</Text>
      <Text dimColor>{pr.url}</Text>
      <Text dimColor>{pad(pr.url, innerWidth) + '│'}</Text>
    </Text>
  );

  lines.push(<Text key="s-end" dimColor>{lb + ' '.repeat(innerWidth) + '│'}</Text>);

  // Scroll indicator
  const VIEWPORT = 20;
  const totalLines = lines.length;
  const visibleLines = lines.slice(scrollOffset, scrollOffset + VIEWPORT);
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + VIEWPORT < totalLines;

  return (
    <Box flexDirection="column">
      {canScrollUp && (
        <Text dimColor>{lb + ' '.repeat((innerWidth - 5) / 2) + '▲ ▲ ▲' + ' '.repeat(Math.max(1, innerWidth - (innerWidth - 5) / 2 - 5)) + '│'}</Text>
      )}
      {visibleLines}
      {canScrollDown && (
        <Text dimColor>{lb + ' '.repeat(Math.floor((innerWidth - 5) / 2)) + '▼ ▼ ▼' + ' '.repeat(Math.max(1, Math.ceil((innerWidth - 5) / 2))) + '│'}</Text>
      )}
    </Box>
  );
}
