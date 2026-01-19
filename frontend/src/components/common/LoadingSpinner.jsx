import React from 'react';
import { Loader, Center, LoadingOverlay } from '@mantine/core';

const LoadingSpinner = ({
  tip = 'Loading...',
  size = 'lg',
  fullScreen = false
}) => {
  // Map sizes to Mantine sizes: 'small' -> 'sm', 'large' -> 'lg'
  const mantineSize = size === 'small' ? 'sm' : size === 'large' ? 'lg' : 'md';

  if (fullScreen) {
    return <LoadingOverlay visible={true} overlayProps={{ blur: 2 }} loaderProps={{ size: mantineSize, children: tip }} />;
  }

  return (
    <Center style={{ minHeight: '200px', flexDirection: 'column', gap: '16px' }}>
      <Loader size={mantineSize} />
      {tip && <div style={{ color: 'var(--mantine-color-dimmed)' }}>{tip}</div>}
    </Center>
  );
};

export default LoadingSpinner;
