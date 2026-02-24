import React from 'react';
import { Box, Text } from 'ink';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    process.stderr.write(`[ErrorBoundary] ${error.message}\n${info.componentStack ?? ''}\n`);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <Box flexDirection="column">
          <Text color="red">Something went wrong: {this.state.error.message}</Text>
          <Text>Press Ctrl+C to exit.</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}
