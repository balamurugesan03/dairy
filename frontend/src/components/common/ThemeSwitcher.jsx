/**
 * ThemeSwitcher Component
 * =======================
 *
 * Ithu oru complete theme switcher:
 * 1. Color Theme Selector - Blue, Red, Green, Violet... (color buttons or dropdown)
 * 2. Dark/Light Mode Toggle
 *
 * Usage:
 * <ThemeSwitcher />                       // Default: color buttons + mode toggle
 * <ThemeSwitcher variant="dropdown" />    // Dropdown select for colors
 * <ThemeSwitcher showModeToggle={false} /> // Only color selector
 * <ThemeSwitcher showColorPicker={false} /> // Only mode toggle
 */

import React, { useState } from 'react';
import {
  ActionIcon,
  Group,
  Popover,
  SimpleGrid,
  Tooltip,
  ColorSwatch,
  useMantineColorScheme,
  Select,
  Paper,
  Text,
  Stack,
  Divider,
  Box,
  rem,
} from '@mantine/core';
import {
  IconSun,
  IconMoon,
  IconPalette,
  IconCheck,
} from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';
import { THEME_OPTIONS } from '../../config/themes';

/**
 * Color Swatch Button - Individual color option
 */
const ColorSwatchButton = ({ color, value, isSelected, onClick }) => (
  <Tooltip label={color.label} position="top" withArrow>
    <ColorSwatch
      color={color.color}
      onClick={() => onClick(value)}
      style={{
        cursor: 'pointer',
        border: isSelected ? '3px solid var(--mantine-color-gray-0)' : '2px solid transparent',
        boxShadow: isSelected ? '0 0 0 2px ' + color.color : 'none',
      }}
      size={32}
    >
      {isSelected && (
        <IconCheck
          size={14}
          color="white"
          style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' }}
        />
      )}
    </ColorSwatch>
  </Tooltip>
);

/**
 * Main ThemeSwitcher Component
 */
const ThemeSwitcher = ({
  variant = 'buttons', // 'buttons' | 'dropdown' | 'popover'
  showModeToggle = true,
  showColorPicker = true,
  size = 'md', // 'sm' | 'md' | 'lg'
}) => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { colorTheme, setColorTheme, currentThemeConfig } = useTheme();
  const [popoverOpened, setPopoverOpened] = useState(false);

  // Size configurations
  const sizeConfig = {
    sm: { icon: 16, swatch: 24, actionIcon: 'md' },
    md: { icon: 20, swatch: 32, actionIcon: 'lg' },
    lg: { icon: 24, swatch: 40, actionIcon: 'xl' },
  };

  const config = sizeConfig[size] || sizeConfig.md;

  // Dark/Light Mode Toggle Button
  const ModeToggleButton = () => (
    <Tooltip
      label={`${colorScheme === 'light' ? 'Dark' : 'Light'} mode`}
      position="bottom"
      withArrow
    >
      <ActionIcon
        onClick={() => toggleColorScheme()}
        size={config.actionIcon}
        variant="default"
        aria-label={`Switch to ${colorScheme === 'light' ? 'dark' : 'light'} mode`}
      >
        {colorScheme === 'light' ? (
          <IconMoon size={config.icon} stroke={1.5} />
        ) : (
          <IconSun size={config.icon} stroke={1.5} />
        )}
      </ActionIcon>
    </Tooltip>
  );

  // Color Picker - Buttons Variant
  const ColorButtonsVariant = () => (
    <Group gap={6}>
      {THEME_OPTIONS.map((theme) => (
        <ColorSwatchButton
          key={theme.value}
          color={theme}
          value={theme.value}
          isSelected={colorTheme === theme.value}
          onClick={setColorTheme}
        />
      ))}
    </Group>
  );

  // Color Picker - Dropdown Variant
  const ColorDropdownVariant = () => (
    <Select
      value={colorTheme}
      onChange={setColorTheme}
      data={THEME_OPTIONS.map((t) => ({
        value: t.value,
        label: t.label,
      }))}
      leftSection={
        <ColorSwatch color={currentThemeConfig.color} size={16} />
      }
      size={size}
      style={{ minWidth: 140 }}
      allowDeselect={false}
    />
  );

  // Color Picker - Popover Variant (compact - shows icon, opens color grid)
  const ColorPopoverVariant = () => (
    <Popover
      opened={popoverOpened}
      onChange={setPopoverOpened}
      position="bottom-end"
      shadow="md"
      width={280}
    >
      <Popover.Target>
        <Tooltip label="Change theme color" position="bottom" withArrow>
          <ActionIcon
            onClick={() => setPopoverOpened((o) => !o)}
            size={config.actionIcon}
            variant="default"
            aria-label="Change theme color"
          >
            <IconPalette
              size={config.icon}
              stroke={1.5}
              color={currentThemeConfig.color}
            />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="sm">
          <Text size="sm" fw={500} c="dimmed">
            Theme Color
          </Text>
          <SimpleGrid cols={6} spacing={8}>
            {THEME_OPTIONS.map((theme) => (
              <ColorSwatchButton
                key={theme.value}
                color={theme}
                value={theme.value}
                isSelected={colorTheme === theme.value}
                onClick={(value) => {
                  setColorTheme(value);
                  setPopoverOpened(false);
                }}
              />
            ))}
          </SimpleGrid>

          {showModeToggle && (
            <>
              <Divider />
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {colorScheme === 'light' ? 'Light Mode' : 'Dark Mode'}
                </Text>
                <ActionIcon
                  onClick={() => toggleColorScheme()}
                  size="md"
                  variant="default"
                >
                  {colorScheme === 'light' ? (
                    <IconMoon size={16} stroke={1.5} />
                  ) : (
                    <IconSun size={16} stroke={1.5} />
                  )}
                </ActionIcon>
              </Group>
            </>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );

  // Render based on variant
  if (variant === 'popover') {
    return <ColorPopoverVariant />;
  }

  return (
    <Group gap="sm">
      {showColorPicker && variant === 'buttons' && <ColorButtonsVariant />}
      {showColorPicker && variant === 'dropdown' && <ColorDropdownVariant />}
      {showModeToggle && variant !== 'popover' && <ModeToggleButton />}
    </Group>
  );
};

/**
 * Compact ThemeSwitcher - Just icon buttons (for navbar/header)
 * Shows: [Palette Icon] [Sun/Moon Icon]
 */
export const ThemeSwitcherCompact = ({ size = 'md' }) => {
  return (
    <Group gap="xs">
      <ThemeSwitcher
        variant="popover"
        showModeToggle={false}
        size={size}
      />
      <ThemeSwitcher
        showColorPicker={false}
        showModeToggle={true}
        size={size}
      />
    </Group>
  );
};

/**
 * ThemeSwitcher Panel - Full settings panel (for settings page)
 */
export const ThemeSwitcherPanel = () => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { colorTheme, setColorTheme, currentThemeConfig } = useTheme();

  return (
    <Paper p="md" withBorder radius="md">
      <Stack gap="md">
        <Box>
          <Text size="sm" fw={600} mb="xs">
            Theme Color
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            App-oda primary color change pannunga
          </Text>
          <SimpleGrid cols={{ base: 4, sm: 6, md: 12 }} spacing={8}>
            {THEME_OPTIONS.map((theme) => (
              <Tooltip key={theme.value} label={theme.label} withArrow>
                <ColorSwatch
                  color={theme.color}
                  onClick={() => setColorTheme(theme.value)}
                  style={{
                    cursor: 'pointer',
                    border: colorTheme === theme.value
                      ? '3px solid var(--mantine-color-gray-5)'
                      : '2px solid transparent',
                    boxShadow: colorTheme === theme.value
                      ? `0 0 0 2px ${theme.color}`
                      : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  size={36}
                >
                  {colorTheme === theme.value && (
                    <IconCheck
                      size={16}
                      color="white"
                      style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' }}
                    />
                  )}
                </ColorSwatch>
              </Tooltip>
            ))}
          </SimpleGrid>
        </Box>

        <Divider />

        <Group justify="space-between">
          <Box>
            <Text size="sm" fw={600}>
              Appearance
            </Text>
            <Text size="xs" c="dimmed">
              {colorScheme === 'light' ? 'Light Mode Active' : 'Dark Mode Active'}
            </Text>
          </Box>
          <Group gap="xs">
            <ActionIcon
              onClick={() => toggleColorScheme()}
              size="xl"
              variant={colorScheme === 'light' ? 'filled' : 'default'}
              color={colorScheme === 'light' ? currentThemeConfig.primaryColor : undefined}
              aria-label="Light mode"
            >
              <IconSun size={20} stroke={1.5} />
            </ActionIcon>
            <ActionIcon
              onClick={() => toggleColorScheme()}
              size="xl"
              variant={colorScheme === 'dark' ? 'filled' : 'default'}
              color={colorScheme === 'dark' ? currentThemeConfig.primaryColor : undefined}
              aria-label="Dark mode"
            >
              <IconMoon size={20} stroke={1.5} />
            </ActionIcon>
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
};

export default ThemeSwitcher;
