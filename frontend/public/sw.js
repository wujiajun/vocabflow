// The service worker of VocabFlow. It does two things only: show the daily reminder when a push
// arrives, and open the study page when the reminder is tapped. It has no fetch handler and caches
// nothing, so the app and its updates are served exactly as before.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const url = typeof data.url === 'string' && data.url.startsWith('/app/') ? data.url : '/app/study'
  event.waitUntil(
    self.registration.showNotification(typeof data.title === 'string' ? data.title : 'VocabFlow', {
      body: typeof data.body === 'string' ? data.body : "Today's words are ready whenever you are.",
      icon: '/icon-192.png',
      // One reminder at a time: a new one replaces an unread old one.
      tag: 'daily-reminder',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/app/study', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus()
          if ('navigate' in client) {
            await client.navigate(target)
          }
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
