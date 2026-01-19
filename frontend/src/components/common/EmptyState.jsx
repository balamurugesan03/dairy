import { Stack, Text, Button, ThemeIcon, List } from '@mantine/core';

const EmptyState = ({
  icon,
  title = 'No data found',
  message = '',
  action = null,
  tips = []
}) => {
  return (
    <Stack align="center" justify="center" gap="md" style={{ minHeight: '300px', padding: '2rem' }}>
      {icon && (
        <ThemeIcon size={64} variant="light" color="gray" radius="xl">
          {icon}
        </ThemeIcon>
      )}
      <Text size="lg" fw={600}>{title}</Text>
      {message && <Text size="sm" c="dimmed" ta="center">{message}</Text>}
      {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
      {tips.length > 0 && (
        <Stack gap="xs" mt="md">
          <Text size="sm" fw={500}>Tips:</Text>
          <List size="sm" spacing="xs">
            {tips.map((tip, index) => (
              <List.Item key={index}>{tip}</List.Item>
            ))}
          </List>
        </Stack>
      )}
    </Stack>
  );
};

export default EmptyState;
