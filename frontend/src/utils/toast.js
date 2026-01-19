import { notifications } from '@mantine/notifications';

// Wrapper to match the previous API while using Mantine notifications
export const message = {
  success: (content, duration = 3000) => {
    notifications.show({
      title: 'Success',
      message: content,
      color: 'green',
      autoClose: duration,
    });
  },
  error: (content, duration = 3000) => {
    notifications.show({
      title: 'Error',
      message: content,
      color: 'red',
      autoClose: duration,
    });
  },
  warning: (content, duration = 3000) => {
    notifications.show({
      title: 'Warning',
      message: content,
      color: 'yellow',
      autoClose: duration,
    });
  },
  info: (content, duration = 3000) => {
    notifications.show({
      title: 'Info',
      message: content,
      color: 'blue',
      autoClose: duration,
    });
  },
  loading: (content) => {
    const id = notifications.show({
      title: 'Loading',
      message: content,
      color: 'blue',
      loading: true,
      autoClose: false,
    });

    // Return a close function for loading messages
    return () => notifications.hide(id);
  }
};

// Also export as default
export default message;
