import { Group, Box, Text, Popover, UnstyledButton, Stack } from '@mantine/core';
import { IconBuildingFactory2, IconBuildingStore } from '@tabler/icons-react';

// From Dairy (this society — Society Info) and To Dairy (Machine Configuration → To Dairy),
// shown next to Session in Milk Purchase and Milk Sales. Click a button for the details.
function DairyButton({ label, dairy, icon: Icon, color, emptyHint }) {
  const name = dairy?.name || '';
  return (
    <Popover position="bottom-start" shadow="md" withArrow zIndex={1100}>
      <Popover.Target>
        <UnstyledButton
          tabIndex={-1}
          style={{
            border: `1.5px solid ${color}55`, background: `${color}0f`, borderRadius: 8,
            padding: '3px 10px', minWidth: 120, maxWidth: 220, height: 36,
          }}
        >
          <Text size="9px" fw={700} c="#64748b" tt="uppercase" style={{ letterSpacing: '0.4px', lineHeight: 1.2 }}>{label}</Text>
          <Group gap={4} wrap="nowrap">
            <Icon size={13} color={color} />
            <Text size="xs" fw={700} c={name ? '#1e293b' : 'dimmed'} truncate>{name || 'Not set'}</Text>
          </Group>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        {name ? (
          <Stack gap={2}>
            <Text size="sm" fw={700}>{name}</Text>
            {dairy.code && <Text size="xs">Code: {dairy.code}</Text>}
            {dairy.address && <Text size="xs">{dairy.address}</Text>}
            {dairy.phone && <Text size="xs">Ph: {dairy.phone}</Text>}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed" maw={240}>{emptyHint}</Text>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

export default function DairyRouteButtons({ fromDairy, toDairy }) {
  return (
    <Box style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
      <DairyButton label="From Dairy" dairy={fromDairy} icon={IconBuildingStore} color="#0f766e"
        emptyHint="Set the society name in Society Info." />
      <DairyButton label="To Dairy" dairy={toDairy} icon={IconBuildingFactory2} color="#7c3aed"
        emptyHint="Set To Dairy in Milk Purchase & Sales → Settings & Configuration → Machine Configuration." />
    </Box>
  );
}
