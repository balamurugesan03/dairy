import { Group, ActionIcon, Button, Text, Menu } from '@mantine/core';
import { IconX, IconDots, IconClipboardList } from '@tabler/icons-react';
import { showConfirmDialog } from './ConfirmDialog';

const BulkActionToolbar = ({
  selectedCount,
  actions = [],
  onClearSelection,
  entityName = 'items'
}) => {
  const handleAction = async (action) => {
    if (action.confirm !== false) {
      const confirmed = await showConfirmDialog({
        title: action.confirmTitle || `${action.label}?`,
        content: action.confirmMessage || `Are you sure you want to ${action.label.toLowerCase()} ${selectedCount} ${entityName}?`,
        okText: action.label,
        type: action.color === 'red' ? 'danger' : 'warning'
      });

      if (!confirmed) return;
    }

    if (action.onClick) {
      action.onClick();
    }
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <Group
      justify="space-between"
      p="md"
      style={{
        background: 'var(--mantine-color-blue-light)',
        borderRadius: 'var(--mantine-radius-md)',
        border: '1px solid var(--mantine-color-blue-outline)'
      }}
    >
      <Group gap="md">
        <IconClipboardList size={20} />
        <Text size="sm" fw={500}>
          <strong>{selectedCount}</strong> {entityName} selected
        </Text>
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconX size={14} />}
          onClick={onClearSelection}
        >
          Clear selection
        </Button>
      </Group>

      <Group gap="sm">
        {actions.slice(0, 3).map((action, index) => (
          <Button
            key={index}
            variant="light"
            color={action.color || 'blue'}
            size="sm"
            leftSection={action.icon}
            onClick={() => handleAction(action)}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        ))}

        {actions.length > 3 && (
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <Button
                variant="light"
                size="sm"
                leftSection={<IconDots size={16} />}
              >
                More
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {actions.slice(3).map((action, index) => (
                <Menu.Item
                  key={index}
                  leftSection={action.icon}
                  onClick={() => handleAction(action)}
                  disabled={action.disabled}
                >
                  {action.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Group>
  );
};

export default BulkActionToolbar;
