import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App as CapacitorApp } from '@capacitor/app';

let isNative = false;

async function initCapacitor() {
  try {
    isNative = typeof window.Capacitor !== 'undefined';
    if (!isNative) return;

    await LocalNotifications.requestPermissions();
    
    LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      const goal = notification.notification.extra?.goal;
      if (goal) {
        window.dispatchEvent(new CustomEvent('capacitor-goal', { detail: goal }));
      }
    });

    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        window.dispatchEvent(new CustomEvent('app-resumed'));
      }
    });
  } catch (e) {
    console.error('Capacitor init error:', e);
  }
}

async function showNativeNotification(goal) {
  if (!isNative) return;
  
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
    
    await LocalNotifications.schedule({
      notifications: [
        {
          title: `⚽ ¡GOL de ${goal.team}!`,
          body: `${goal.homeName} ${goal.score} ${goal.awayName}`,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 1000) },
          sound: null,
          attachments: null,
          actionTypeId: "",
          extra: { goal },
        }
      ]
    });
  } catch (e) {
    console.error('Native notification error:', e);
  }
}

function isNativeApp() {
  return isNative;
}

export { initCapacitor, showNativeNotification, isNativeApp };
