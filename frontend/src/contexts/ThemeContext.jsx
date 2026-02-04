/**
 * Global Theme Context
 * ====================
 *
 * Ithu full app-oda theme control pannurathu:
 * 1. Color Theme - blue, red, green, violet, orange, etc. (N number of colors)
 * 2. Color Scheme - light / dark mode
 *
 * LocalStorage-la save aagum, so refresh pannaalum theme maraathu.
 *
 * Usage:
 * const { colorTheme, setColorTheme, colorScheme, toggleColorScheme } = useTheme();
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { THEMES, DEFAULT_THEME, DEFAULT_COLOR_SCHEME, getThemeCSSVariables } from '../config/themes';

const ThemeContext = createContext(undefined);

// LocalStorage keys
const STORAGE_KEYS = {
  COLOR_THEME: 'app-color-theme',
  COLOR_SCHEME: 'app-color-scheme',
};

export const ThemeProvider = ({ children }) => {
  // Color Theme State (blue, red, green, etc.)
  const [colorTheme, setColorThemeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COLOR_THEME);
    // Validate saved theme exists in THEMES
    if (saved && THEMES[saved]) {
      return saved;
    }
    return DEFAULT_THEME;
  });

  // Color Scheme State (light/dark)
  const [colorScheme, setColorSchemeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COLOR_SCHEME);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return DEFAULT_COLOR_SCHEME;
  });

  // Apply CSS variables when color theme changes
  useEffect(() => {
    const cssVars = getThemeCSSVariables(colorTheme);
    const root = document.documentElement;

    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.COLOR_THEME, colorTheme);
  }, [colorTheme]);

  // Apply color scheme (light/dark) to document
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', colorScheme);
    root.setAttribute('data-mantine-color-scheme', colorScheme);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.COLOR_SCHEME, colorScheme);
  }, [colorScheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      // Only auto-switch if user hasn't manually set a preference
      const savedScheme = localStorage.getItem(STORAGE_KEYS.COLOR_SCHEME);
      if (!savedScheme) {
        setColorSchemeState(e.matches ? 'dark' : 'light');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Set color theme (with validation)
  const setColorTheme = useCallback((theme) => {
    if (THEMES[theme]) {
      setColorThemeState(theme);
    } else {
      console.warn(`Theme "${theme}" not found. Using default.`);
      setColorThemeState(DEFAULT_THEME);
    }
  }, []);

  // Set color scheme
  const setColorScheme = useCallback((scheme) => {
    if (scheme === 'light' || scheme === 'dark') {
      setColorSchemeState(scheme);
    }
  }, []);

  // Toggle color scheme (light <-> dark)
  const toggleColorScheme = useCallback(() => {
    setColorSchemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Get current theme config
  const currentThemeConfig = useMemo(() => {
    return THEMES[colorTheme] || THEMES[DEFAULT_THEME];
  }, [colorTheme]);

  // Context value
  const value = useMemo(() => ({
    // Color Theme (blue, red, green, etc.)
    colorTheme,
    setColorTheme,
    currentThemeConfig,

    // Color Scheme (light/dark)
    colorScheme,
    setColorScheme,
    toggleColorScheme,
    isDark: colorScheme === 'dark',
    isLight: colorScheme === 'light',

    // Legacy support (backward compatibility)
    theme: colorScheme,
    toggleTheme: toggleColorScheme,
  }), [
    colorTheme,
    setColorTheme,
    currentThemeConfig,
    colorScheme,
    setColorScheme,
    toggleColorScheme,
  ]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
