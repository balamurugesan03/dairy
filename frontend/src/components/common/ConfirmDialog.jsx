import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';

export const showConfirmDialog = (config) => {
  const {
    title = 'Confirm Action',
    content = 'Are you sure you want to proceed?',
    onConfirm,
    onCancel,
    okText = 'Confirm',
    cancelText = 'Cancel',
    type = 'warning'
  } = config;

  return new Promise((resolve) => {
    modals.openConfirmModal({
      title: title,
      children: (
        <Text size="sm">
          {content}
        </Text>
      ),
      labels: { confirm: okText, cancel: cancelText },
      confirmProps: {
        color: type === 'danger' ? 'red' : 'blue'
      },
      onConfirm: () => {
        if (onConfirm) onConfirm();
        resolve(true);
      },
      onCancel: () => {
        if (onCancel) onCancel();
        resolve(false);
      },
    });
  });
};

export default showConfirmDialog;
