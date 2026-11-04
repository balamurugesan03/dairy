import { Card, Group, ThemeIcon, Text } from '@mantine/core';

const StatCard = ({ icon, label, value, color, sub }) => (
  <Card shadow="sm" padding="md" radius="md" withBorder>
    <Group wrap="nowrap">
      <ThemeIcon size={44} radius="md" variant="light" color={color}>{icon}</ThemeIcon>
      <div style={{ minWidth: 0 }}>
        <Text fw={700} size="xl" truncate>{value}</Text>
        <Text size="sm" c="dimmed">{label}</Text>
        {sub && <Text size="xs" c="dimmed">{sub}</Text>}
      </div>
    </Group>
  </Card>
);

export default StatCard;
