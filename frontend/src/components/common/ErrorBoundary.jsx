import React from 'react';
import { Alert, Stack, Button, Group, Center } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <Center style={{ minHeight: '100vh', padding: '2rem' }}>
          <Stack align="center" gap="xl" style={{ maxWidth: 500 }}>
            <IconAlertCircle size={80} color="var(--mantine-color-red-6)" />
            <Alert
              color="red"
              title="Something went wrong"
              icon={<IconAlertCircle />}
              variant="light"
              style={{ width: '100%' }}
            >
              An unexpected error occurred. Please try refreshing the page.
            </Alert>
            <Group gap="md">
              <Button onClick={this.handleReset}>
                Go Home
              </Button>
              <Button variant="default" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </Group>
          </Stack>
        </Center>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
