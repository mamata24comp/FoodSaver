/* FoodSaver Service Worker — handles background push notifications */
const CACHE = 'foodsaver-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

/* ── PUSH EVENT ── */
self.addEventListener('push', e => {
  let d = { title:'🌱 FoodSaver Alert', body:'Food items expiring soon!', icon:'/icon-192.png' };
  if (e.data) { try { d = e.data.json(); } catch(_) { d.body = e.data.text(); } }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: d.icon || '/icon-192.png',
    badge: '/icon-72.png',
    tag: d.tag || 'foodsaver-expiry',
    renotify: true,
    vibrate: [200,100,200],
    data: { url: d.url || '/inventory.html' },
    actions: [
      { action:'view',    title:'👀 View Inventory' },
      { action:'dismiss', title:'✕ Dismiss' }
    ]
  }));
});

/* ── NOTIFICATION CLICK ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = (e.notification.data && e.notification.data.url) || '/inventory.html';
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) { c.focus(); c.navigate(url); return; }
      }
      return clients.openWindow(url);
    })
  );
});
