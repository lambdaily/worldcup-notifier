let isNative = false;
let GoalOverlay = null;

async function initCapacitor() {
  try {
    isNative = typeof window.Capacitor !== 'undefined';
    if (!isNative) return;

    const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
    const Haptics = window.Capacitor.Plugins.Haptics;
    const CapacitorApp = window.Capacitor.Plugins.App;
    GoalOverlay = window.Capacitor.Plugins.GoalOverlay;

    await LocalNotifications.requestPermissions();
    
    await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      const goal = notification.notification.extra?.goal;
      if (goal) {
        window.dispatchEvent(new CustomEvent('capacitor-goal', { detail: goal }));
      }
    });

    await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        window.dispatchEvent(new CustomEvent('app-resumed'));
      }
    });

    window._LocalNotifications = LocalNotifications;
    window._Haptics = Haptics;
    
    if (GoalOverlay) {
      const hasPermission = await GoalOverlay.hasOverlayPermission();
      if (!hasPermission.hasPermission) {
        await GoalOverlay.requestOverlayPermission();
      }
    }
    
    console.log('Capacitor initialized:', { isNative, LocalNotifications, Haptics, GoalOverlay });
  } catch (e) {
    console.error('Capacitor init error:', e);
  }
}

async function showNativeNotification(goal) {
  if (!isNative || !window._LocalNotifications) {
    console.log('Native notification skipped: not in native mode');
    return;
  }
  
  try {
    console.log('Showing native notification for goal:', goal);
    
    if (window._Haptics) {
      await window._Haptics.impact({ style: 'HEAVY' });
    }
    
    if (GoalOverlay) {
      await GoalOverlay.showGoalOverlay(goal);
      console.log('Overlay shown');
    }
    
    await window._LocalNotifications.schedule({
      notifications: [
        {
          title: `⚽ ¡GOL de ${goal.team}!`,
          body: `${goal.homeName} ${goal.score} ${goal.awayName}`,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 500) },
          sound: null,
          attachments: null,
          actionTypeId: "",
          extra: { goal },
        }
      ]
    });
    
    console.log('Native notification scheduled');
  } catch (e) {
    console.error('Native notification error:', e);
  }
}

function isNativeApp() {
  return isNative;
}

export { initCapacitor, showNativeNotification, isNativeApp };
