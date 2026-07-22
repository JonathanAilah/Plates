// Service worker for Plates push notifications.
// Runs independently of the page — this is what wakes up when a push
// arrives, even if the tab/app is closed.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'Plates', body: event.data.text() };
  }

  const title = payload.title || 'Plates';
  const options = {
    body: payload.body || '',
    icon: '/brand/icon-192.png',
    badge: '/brand/favicon-48.png',
    data: {
      url: payload.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// When a cook taps the notification, focus/open the app at the relevant page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});