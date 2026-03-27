import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

type NotificationType = 'work-complete' | 'break-complete';

export const showNotification = async (type: NotificationType): Promise<void> => {
  let permissionGranted = await isPermissionGranted();

  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }

  if (!permissionGranted) {
    return;
  }

  const titles: Record<NotificationType, string> = {
    'work-complete': '🎉 Work Session Complete!',
    'break-complete': '☕ Break Time Over!',
  };

  const bodies: Record<NotificationType, string> = {
    'work-complete': 'Great work! Time for a break.',
    'break-complete': 'Ready to focus again?',
  };

  sendNotification({
    title: titles[type],
    body: bodies[type],
  });
};