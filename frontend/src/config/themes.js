/**
 * Global Color Theme Configuration
 * ================================
 *
 * Ithu oru scalable theme system - N number of colors add pannalaam.
 * Each theme la primary color, shades, and Mantine theme object irukku.
 *
 * Usage:
 * - THEMES object la all available themes irukku
 * - getMantineTheme() function use panni Mantine-compatible theme edukkalaam
 * - THEME_OPTIONS array use panni UI-la dropdown/buttons show pannalaam
 */

// All available color themes with their configurations
export const THEMES = {
  blue: {
    name: 'Blue',
    primaryColor: 'blue',
    color: '#228be6',
    colors: {
      primary: '#228be6',
      primaryHover: '#1c7ed6',
      primaryActive: '#1971c2',
      primaryLight: 'rgba(34, 139, 230, 0.1)',
    },
    // Mantine color shades (index 0-9, default primary is index 6)
    mantineShades: [
      '#e7f5ff', '#d0ebff', '#a5d8ff', '#74c0fc', '#4dabf7',
      '#339af0', '#228be6', '#1c7ed6', '#1971c2', '#1864ab'
    ]
  },

  teal: {
    name: 'Teal',
    primaryColor: 'teal',
    color: '#12b886',
    colors: {
      primary: '#12b886',
      primaryHover: '#0ca678',
      primaryActive: '#099268',
      primaryLight: 'rgba(18, 184, 134, 0.1)',
    },
    mantineShades: [
      '#e6fcf5', '#c3fae8', '#96f2d7', '#63e6be', '#38d9a9',
      '#20c997', '#12b886', '#0ca678', '#099268', '#087f5b'
    ]
  },

  green: {
    name: 'Green',
    primaryColor: 'green',
    color: '#40c057',
    colors: {
      primary: '#40c057',
      primaryHover: '#37b24d',
      primaryActive: '#2f9e44',
      primaryLight: 'rgba(64, 192, 87, 0.1)',
    },
    mantineShades: [
      '#ebfbee', '#d3f9d8', '#b2f2bb', '#8ce99a', '#69db7c',
      '#51cf66', '#40c057', '#37b24d', '#2f9e44', '#2b8a3e'
    ]
  },

  violet: {
    name: 'Violet',
    primaryColor: 'violet',
    color: '#7950f2',
    colors: {
      primary: '#7950f2',
      primaryHover: '#7048e8',
      primaryActive: '#6741d9',
      primaryLight: 'rgba(121, 80, 242, 0.1)',
    },
    mantineShades: [
      '#f3f0ff', '#e5dbff', '#d0bfff', '#b197fc', '#9775fa',
      '#845ef7', '#7950f2', '#7048e8', '#6741d9', '#5f3dc4'
    ]
  },

  grape: {
    name: 'Grape',
    primaryColor: 'grape',
    color: '#be4bdb',
    colors: {
      primary: '#be4bdb',
      primaryHover: '#ae3ec9',
      primaryActive: '#9c36b5',
      primaryLight: 'rgba(190, 75, 219, 0.1)',
    },
    mantineShades: [
      '#f8f0fc', '#f3d9fa', '#eebefa', '#e599f7', '#da77f2',
      '#cc5de8', '#be4bdb', '#ae3ec9', '#9c36b5', '#862e9c'
    ]
  },

  pink: {
    name: 'Pink',
    primaryColor: 'pink',
    color: '#e64980',
    colors: {
      primary: '#e64980',
      primaryHover: '#d6336c',
      primaryActive: '#c2255c',
      primaryLight: 'rgba(230, 73, 128, 0.1)',
    },
    mantineShades: [
      '#fff0f6', '#ffdeeb', '#fcc2d7', '#faa2c1', '#f783ac',
      '#f06595', '#e64980', '#d6336c', '#c2255c', '#a61e4d'
    ]
  },

  red: {
    name: 'Red',
    primaryColor: 'red',
    color: '#fa5252',
    colors: {
      primary: '#fa5252',
      primaryHover: '#f03e3e',
      primaryActive: '#e03131',
      primaryLight: 'rgba(250, 82, 82, 0.1)',
    },
    mantineShades: [
      '#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787',
      '#ff6b6b', '#fa5252', '#f03e3e', '#e03131', '#c92a2a'
    ]
  },

  orange: {
    name: 'Orange',
    primaryColor: 'orange',
    color: '#fd7e14',
    colors: {
      primary: '#fd7e14',
      primaryHover: '#f76707',
      primaryActive: '#e8590c',
      primaryLight: 'rgba(253, 126, 20, 0.1)',
    },
    mantineShades: [
      '#fff4e6', '#ffe8cc', '#ffd8a8', '#ffc078', '#ffa94d',
      '#ff922b', '#fd7e14', '#f76707', '#e8590c', '#d9480f'
    ]
  },

  yellow: {
    name: 'Yellow',
    primaryColor: 'yellow',
    color: '#fab005',
    colors: {
      primary: '#fab005',
      primaryHover: '#f59f00',
      primaryActive: '#f08c00',
      primaryLight: 'rgba(250, 176, 5, 0.1)',
    },
    mantineShades: [
      '#fff9db', '#fff3bf', '#ffec99', '#ffe066', '#ffd43b',
      '#fcc419', '#fab005', '#f59f00', '#f08c00', '#e67700'
    ]
  },

  lime: {
    name: 'Lime',
    primaryColor: 'lime',
    color: '#82c91e',
    colors: {
      primary: '#82c91e',
      primaryHover: '#74b816',
      primaryActive: '#66a80f',
      primaryLight: 'rgba(130, 201, 30, 0.1)',
    },
    mantineShades: [
      '#f4fce3', '#e9fac8', '#d8f5a2', '#c0eb75', '#a9e34b',
      '#94d82d', '#82c91e', '#74b816', '#66a80f', '#5c940d'
    ]
  },

  cyan: {
    name: 'Cyan',
    primaryColor: 'cyan',
    color: '#15aabf',
    colors: {
      primary: '#15aabf',
      primaryHover: '#1098ad',
      primaryActive: '#0c8599',
      primaryLight: 'rgba(21, 170, 191, 0.1)',
    },
    mantineShades: [
      '#e3fafc', '#c5f6fa', '#99e9f2', '#66d9e8', '#3bc9db',
      '#22b8cf', '#15aabf', '#1098ad', '#0c8599', '#0b7285'
    ]
  },

  indigo: {
    name: 'Indigo',
    primaryColor: 'indigo',
    color: '#4c6ef5',
    colors: {
      primary: '#4c6ef5',
      primaryHover: '#4263eb',
      primaryActive: '#3b5bdb',
      primaryLight: 'rgba(76, 110, 245, 0.1)',
    },
    mantineShades: [
      '#edf2ff', '#dbe4ff', '#bac8ff', '#91a7ff', '#748ffc',
      '#5c7cfa', '#4c6ef5', '#4263eb', '#3b5bdb', '#364fc7'
    ]
  },
};

// Theme options array for UI (dropdown/buttons)
export const THEME_OPTIONS = Object.entries(THEMES).map(([key, theme]) => ({
  value: key,
  label: theme.name,
  color: theme.color,
}));

// Default theme
export const DEFAULT_THEME = 'blue';

// Default color scheme (light/dark)
export const DEFAULT_COLOR_SCHEME = 'light';

/**
 * Get Mantine theme configuration for a specific color theme
 * @param {string} themeKey - Theme key (blue, red, green, etc.)
 * @returns {Object} Mantine theme object
 */
export const getMantineTheme = (themeKey = DEFAULT_THEME) => {
  const theme = THEMES[themeKey] || THEMES[DEFAULT_THEME];

  return {
    primaryColor: theme.primaryColor,
    primaryShade: { light: 6, dark: 7 },
    fontFamily: 'Gabarito, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    headings: {
      fontFamily: 'Gabarito, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    },
    colors: {
      [theme.primaryColor]: theme.mantineShades,
    },
    components: {
      Button: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      ActionIcon: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Loader: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Progress: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Badge: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      NavLink: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Tabs: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Checkbox: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Radio: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Switch: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Stepper: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Pagination: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
      Anchor: {
        defaultProps: {
          color: theme.primaryColor,
        },
      },
    },
  };
};

/**
 * Get CSS variables for a specific theme
 * @param {string} themeKey - Theme key
 * @returns {Object} CSS variables object
 */
export const getThemeCSSVariables = (themeKey = DEFAULT_THEME) => {
  const theme = THEMES[themeKey] || THEMES[DEFAULT_THEME];

  return {
    '--primary-color': theme.colors.primary,
    '--primary-hover': theme.colors.primaryHover,
    '--primary-active': theme.colors.primaryActive,
    '--primary-light': theme.colors.primaryLight,
    '--border-active': theme.colors.primary,
  };
};

export default THEMES;
