/**
 * ThemeToggle Component
 * =====================
 *
 * Simple dark/light mode toggle button.
 * Uses our custom ThemeContext for state management.
 */

import React from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle = ({ size = 'lg' }) => {
  const { colorScheme, toggleColorScheme } = useTheme();

  return (
    <Tooltip
      label={`Switch to ${colorScheme === 'light' ? 'dark' : 'light'} mode`}
      position="bottom"
      withArrow
    >
      <ActionIcon
        onClick={toggleColorScheme}
        size={size}
        variant="default"
        aria-label={`Switch to ${colorScheme === 'light' ? 'dark' : 'light'} mode`}
      >
        {colorScheme === 'light' ? (
          <IconMoon size={20} stroke={1.5} />
        ) : (
          <IconSun size={20} stroke={1.5} />
        )}
      </ActionIcon>
    </Tooltip>
  );
};

export default ThemeToggle;
