#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

console.clear();

const { waitUntilExit } = render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

waitUntilExit().then(() => {
  console.log('\n👋 Goodbye!\n');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!\n');
  process.exit(0);
});
