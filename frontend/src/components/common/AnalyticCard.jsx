/**
 * AnalyticCard Component - Colorful Dashboard Cards
 * ==================================================
 *
 * Attractive gradient background cards for dashboard metrics.
 * Each color has its own gradient that looks beautiful.
 */

import { Card, Text, Group, Stack, ThemeIcon, Box } from '@mantine/core';
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

// Gradient configurations for each color
const CARD_GRADIENTS = {
  blue: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    light: 'linear-gradient(135deg, #e0f7fa 0%, #e8eaf6 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
  green: {
    gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    light: 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
  teal: {
    gradient: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)',
    light: 'linear-gradient(135deg, #e0f2f1 0%, #e1f5fe 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
  orange: {
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    light: 'linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
  violet: {
    gradient: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    light: 'linear-gradient(135deg, #f3e5f5 0%, #ede7f6 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
  pink: {
    gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
    light: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
  cyan: {
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    light: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
  red: {
    gradient: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
    light: 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
  yellow: {
    gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    light: 'linear-gradient(135deg, #fffde7 0%, #fff8e1 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
  indigo: {
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    light: 'linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
  },
};

const AnalyticCard = ({
  title,
  value,
  icon,
  trend = null,
  color = 'blue',
  onClick = null,
  sparklineData = null,
  subtitle = null,
  variant = 'gradient', // 'gradient' | 'light' | 'simple'
}) => {
  const gradientConfig = CARD_GRADIENTS[color] || CARD_GRADIENTS.blue;
  const isGradient = variant === 'gradient';
  const isLight = variant === 'light';

  const getTrendIcon = () => {
    if (!trend) return null;

    const direction = trend.direction || 'neutral';
    const percentage = trend.value || 0;

    if (direction === 'up') {
      return (
        <Group
          gap="xs"
          style={{
            color: isGradient ? 'rgba(255,255,255,0.9)' : 'var(--mantine-color-green-6)',
            background: isGradient ? 'rgba(255,255,255,0.15)' : 'var(--mantine-color-green-0)',
            padding: '4px 8px',
            borderRadius: '12px',
          }}
        >
          <IconTrendingUp size={14} />
          <Text size="xs" fw={600}>{percentage}%</Text>
        </Group>
      );
    } else if (direction === 'down') {
      return (
        <Group
          gap="xs"
          style={{
            color: isGradient ? 'rgba(255,255,255,0.9)' : 'var(--mantine-color-red-6)',
            background: isGradient ? 'rgba(255,255,255,0.15)' : 'var(--mantine-color-red-0)',
            padding: '4px 8px',
            borderRadius: '12px',
          }}
        >
          <IconTrendingDown size={14} />
          <Text size="xs" fw={600}>{percentage}%</Text>
        </Group>
      );
    }

    return (
      <Text size="sm" c={isGradient ? 'white' : 'dimmed'}>{percentage}%</Text>
    );
  };

  const cardStyle = {
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.3s ease',
    background: isGradient
      ? gradientConfig.gradient
      : isLight
        ? gradientConfig.light
        : undefined,
    border: isGradient ? 'none' : undefined,
    overflow: 'hidden',
    position: 'relative',
  };

  return (
    <Card
      shadow={isGradient ? 'lg' : 'sm'}
      padding="lg"
      radius="lg"
      withBorder={!isGradient}
      style={cardStyle}
      onClick={onClick}
      className="analytic-card"
    >
      {/* Decorative circles for gradient variant */}
      {isGradient && (
        <>
          <Box
            style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
            }}
          />
          <Box
            style={{
              position: 'absolute',
              bottom: '-30px',
              left: '-30px',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
            }}
          />
        </>
      )}

      <Stack gap="md" style={{ position: 'relative', zIndex: 1 }}>
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            {icon && (
              <ThemeIcon
                size="xl"
                radius="md"
                variant={isGradient ? 'white' : 'light'}
                color={isGradient ? 'white' : color}
                style={{
                  background: isGradient ? 'rgba(255,255,255,0.2)' : undefined,
                  backdropFilter: isGradient ? 'blur(4px)' : undefined,
                }}
              >
                {icon}
              </ThemeIcon>
            )}
          </Group>
          {getTrendIcon()}
        </Group>

        <div>
          <Text
            size="sm"
            fw={500}
            c={isGradient ? 'rgba(255,255,255,0.85)' : 'dimmed'}
            mb={4}
          >
            {title}
          </Text>
          <Text
            size="xl"
            fw={700}
            c={isGradient ? 'white' : undefined}
            style={{ fontSize: '1.75rem' }}
          >
            {value}
          </Text>
        </div>

        {subtitle && (
          <Text
            size="sm"
            c={isGradient ? 'rgba(255,255,255,0.8)' : 'dimmed'}
            style={{
              background: isGradient ? 'rgba(255,255,255,0.1)' : undefined,
              padding: isGradient ? '4px 8px' : undefined,
              borderRadius: '6px',
              display: 'inline-block',
            }}
          >
            {subtitle}
          </Text>
        )}

        {sparklineData && (
          <div style={{ marginTop: '8px' }}>
            <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
              <polyline
                points={sparklineData.map((val, idx) => {
                  const x = (idx / (sparklineData.length - 1)) * 100;
                  const y = 40 - ((val / Math.max(...sparklineData)) * 30);
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke={isGradient ? 'rgba(255,255,255,0.8)' : `var(--mantine-color-${color}-6)`}
                strokeWidth="2"
              />
            </svg>
          </div>
        )}
      </Stack>

      <style>{`
        .analytic-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </Card>
  );
};

export default AnalyticCard;
