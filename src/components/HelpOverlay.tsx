import React from 'react';
import { Box, Text } from 'ink';

interface HelpOverlayProps {
  boxWidth: number;
}

const SECTIONS = [
  {
    title: 'List View',
    keys: [
      ['↑ / ↓', 'Navigate PRs'],
      ['Enter', 'Open detail view'],
      ['r', 'Refresh all PRs'],
      ['b', 'Toggle bot PRs'],
      ['s', 'Cycle sort (score/updated/created)'],
      ['/', 'Cycle repo filter'],
    ],
  },
  {
    title: 'Detail View',
    keys: [
      ['Esc', 'Back to list'],
      ['↑ / ↓', 'Scroll line by line'],
      ['Ctrl+U / Ctrl+D', 'Page up / page down'],
      ['y', 'Copy PR URL to clipboard'],
      ['o', 'Open PR in browser'],
      ['m', 'Squash merge + delete branch'],
    ],
  },
  {
    title: 'Agent Actions (Detail View)',
    keys: [
      ['v', 'Run agent review'],
      ['f', 'Fix review comments (after review)'],
      ['t', 'Fix TypeScript errors'],
      ['x', 'Rebase on base branch'],
    ],
  },
];

function pad(text: string, width: number): string {
  return ' '.repeat(Math.max(1, width - text.length));
}

export function HelpOverlay({ boxWidth }: HelpOverlayProps) {
  const innerWidth = boxWidth - 2;
  const lines: React.ReactElement[] = [];

  lines.push(<Text key="s0" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

  const header = 'Keyboard Shortcuts';
  lines.push(
    <Text key="header">
      <Text dimColor>{'│  '}</Text>
      <Text bold color="cyan">{header}</Text>
      <Text dimColor>{pad(header, innerWidth) + '│'}</Text>
    </Text>
  );

  lines.push(<Text key="s1" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

  SECTIONS.forEach((section, si) => {
    lines.push(
      <Text key={`sh-${si}`}>
        <Text dimColor>{'│  '}</Text>
        <Text bold>{section.title}</Text>
        <Text dimColor>{pad(section.title, innerWidth) + '│'}</Text>
      </Text>
    );

    section.keys.forEach(([key, desc], ki) => {
      const keyPad = (key ?? '').padEnd(16);
      const lineText = `    ${keyPad} ${desc}`;
      lines.push(
        <Text key={`sk-${si}-${ki}`}>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'    '}</Text>
          <Text color="cyan">{keyPad}</Text>
          <Text>{' '}{desc}</Text>
          <Text dimColor>{pad(lineText, innerWidth) + '│'}</Text>
        </Text>
      );
    });

    if (si < SECTIONS.length - 1) {
      lines.push(<Text key={`ss-${si}`} dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);
    }
  });

  lines.push(<Text key="s-end" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

  const hint = 'Press ? or Esc to close';
  lines.push(
    <Text key="close-hint">
      <Text dimColor>{'│  '}</Text>
      <Text dimColor>{hint}</Text>
      <Text dimColor>{pad(hint, innerWidth) + '│'}</Text>
    </Text>
  );

  lines.push(<Text key="s-final" dimColor>{'│' + ' '.repeat(innerWidth) + '│'}</Text>);

  return (
    <Box flexDirection="column">
      {lines}
    </Box>
  );
}
