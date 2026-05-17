export async function checkAndNotify(tonightScore) {
  if (tonightScore < 7.5) return;

  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const timeValue = hour + minutes / 60;

  if (timeValue < 13.5 || timeValue > 15.0) return;

  const lastSent = localStorage.getItem('lastNotificationDate');
  const today = now.toDateString();
  if (lastSent === today) return;

  const send = () => {
    new Notification('Home Chill Factor', {
      body: 'Cold night ahead — prep the fireplace now for overnight warmth.',
      icon: '/assets/icons/icon-192.png'
    });
    localStorage.setItem('lastNotificationDate', today);
  };

  if (Notification.permission === 'granted') {
    send();
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') send();
  }
}

export function requestNotificationPermissionLater() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  setTimeout(() => {
    Notification.requestPermission();
  }, 8000);
}
