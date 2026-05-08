// This file is imported by the service worker via workbox importScripts
self.addEventListener('push', (event) => {
  let data = { title: '🔥 Quest dropped!', body: 'A new quest is ready.', url: '/' }
  try { data = JSON.parse(event.data?.text() ?? '{}') } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(url));
});
