import React from 'react';
import { Group, Title, Text, Stack } from '@mantine/core';

const PageHeader = ({
  title,
  extra,
  subtitle,
  style = {}
}) => {
  return (
    <Group justify="space-between" align="flex-start" mb="md" style={style}>
      <Stack gap="xs">
        <Title order={2}>{title}</Title>
        {subtitle && (
          <Text size="sm" c="dimmed">{subtitle}</Text>
        )}
      </Stack>
      {extra && <div>{extra}</div>}
    </Group>
  );
};

export default PageHeader;
