import { Card, Text, Group, Stack, ThemeIcon } from '@mantine/core';
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

const AnalyticCard = ({
  title,
  value,
  icon,
  trend = null,
  color = 'blue',
  onClick = null,
  sparklineData = null,
  subtitle = null
}) => {
  const getTrendIcon = () => {
    if (!trend) return null;

    const direction = trend.direction || 'neutral';
    const percentage = trend.value || 0;

    if (direction === 'up') {
      return (
        <Group gap="xs" style={{ color: 'var(--mantine-color-green-6)' }}>
          <IconTrendingUp size={16} />
          <Text size="sm" fw={500}>{percentage}%</Text>
        </Group>
      );
    } else if (direction === 'down') {
      return (
        <Group gap="xs" style={{ color: 'var(--mantine-color-red-6)' }}>
          <IconTrendingDown size={16} />
          <Text size="sm" fw={500}>{percentage}%</Text>
        </Group>
      );
    }

    return (
      <Text size="sm" c="dimmed">{percentage}%</Text>
    );
  };

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s',
        '&:hover': onClick ? { transform: 'translateY(-2px)' } : {}
      }}
      onClick={onClick}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            {icon && (
              <ThemeIcon size="lg" variant="light" color={color}>
                {icon}
              </ThemeIcon>
            )}
            <Text size="sm" fw={500} c="dimmed">{title}</Text>
          </Group>
          {getTrendIcon()}
        </Group>

        <Text size="xl" fw={700}>{value}</Text>

        {subtitle && <Text size="sm" c="dimmed">{subtitle}</Text>}

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
                stroke={`var(--mantine-color-${color}-6)`}
                strokeWidth="2"
              />
            </svg>
          </div>
        )}
      </Stack>
    </Card>
  );
};

export default AnalyticCard;
