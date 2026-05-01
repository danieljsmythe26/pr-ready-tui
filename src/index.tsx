#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

const ENTER_ALT_SCREEN = '\u001b[?1049h\u001b[H';
const EXIT_ALT_SCREEN = '\u001b[?1049l';

const usingAltScreen = process.stdout.isTTY;
let restoredScreen = false;

if (usingAltScreen) {
  process.stdout.write(ENTER_ALT_SCREEN);
} else {
  console.clear();
}

function restoreScreen() {
  if (!usingAltScreen || restoredScreen) return;
  restoredScreen = true;
  process.stdout.write(EXIT_ALT_SCREEN);
}

const { waitUntilExit } = render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

waitUntilExit().then(() => {
  restoreScreen();
  console.log('\n👋 Goodbye!\n');
  process.exit(0);
});

process.on('SIGINT', () => {
  restoreScreen();
  console.log('\n👋 Goodbye!\n');
  process.exit(0);
});

process.on('exit', restoreScreen);
