import React from 'react';
import { ActionIcon, useMantineColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';

const ThemeToggle = () => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <ActionIcon
      onClick={() => toggleColorScheme()}
      size="lg"
      variant="default"
      aria-label={`Switch to ${colorScheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${colorScheme === 'light' ? 'dark' : 'light'} mode`}
    >
      {colorScheme === 'light' ? (
        <IconSun size={20} stroke={1.5} />
      ) : (
        <IconMoon size={20} stroke={1.5} />
      )}
    </ActionIcon>
  );
};

export default ThemeToggle;
