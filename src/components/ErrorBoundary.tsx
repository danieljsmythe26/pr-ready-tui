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

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <Box flexDirection="column">
          <Text color="red">Something went wrong: {this.state.error.message}</Text>
          <Text>Press q to quit, r to retry</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}
