import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { deletePushSubscription, getPushConfig, listPushSubscriptions, savePushSubscription } from '../api/pushApi'
import { keyToBytes, pushSupport } from '../pushSupport'

export const defaultReminderTime = '19:00'

const keys = {
  config: ['push', 'config'] as const,
  mine: ['push', 'subscription'] as const,
}

export class ReminderPermissionError extends Error {}

export function useReminder() {
  const queryClient = useQueryClient()
  const support = pushSupport()
  const usable = support === 'ok'

  const config = useQuery({ queryKey: keys.config, queryFn: getPushConfig, enabled: usable, staleTime: Infinity })
  const serverReady = usable && config.data?.enabled === true
  const mine = useQuery({ queryKey: keys.mine, queryFn: listPushSubscriptions, enabled: serverReady })

  // This browser's own subscription: undefined while it is being looked up, null when there is none.
  const [endpoint, setEndpoint] = useState<string | null | undefined>(usable ? undefined : null)
  useEffect(() => {
    if (!usable) {
      return
    }
    let active = true
    navigator.serviceWorker
      .getRegistration('/sw.js')
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => active && setEndpoint(subscription?.endpoint ?? null))
      .catch(() => active && setEndpoint(null))
    return () => {
      active = false
    }
  }, [usable])

  const current = mine.data?.find((subscription) => subscription.endpoint === endpoint)

  const enable = useMutation({
    mutationFn: async (remindAt: string) => {
      const publicKey = config.data?.publicKey
      if (!publicKey) {
        throw new Error('Reminders are not set up on this server.')
      }
      // Asked from the press itself, which is what browsers (iOS above all) require.
      if ((await Notification.requestPermission()) !== 'granted') {
        throw new ReminderPermissionError()
      }
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }))
      await save(subscription, remindAt)
      return subscription.endpoint
    },
    onSuccess: async (newEndpoint) => {
      setEndpoint(newEndpoint)
      await queryClient.invalidateQueries({ queryKey: keys.mine })
    },
  })

  const changeTime = useMutation({
    mutationFn: async (remindAt: string) => {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) {
        throw new Error('This device is not subscribed.')
      }
      await save(subscription, remindAt)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.mine }),
  })

  const disable = useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
    },
    onSuccess: async () => {
      setEndpoint(null)
      await queryClient.invalidateQueries({ queryKey: keys.mine })
    },
  })

  return {
    support,
    // Settled once the server's answer and this browser's subscription are known.
    loading: usable && (config.isPending || (serverReady && (mine.isPending || endpoint === undefined))),
    loadFailed: config.isError || mine.isError,
    serverReady: !usable || config.isPending || config.data?.enabled === true,
    permission: usable ? Notification.permission : 'default',
    on: current !== undefined,
    remindAt: current?.remindAt ?? defaultReminderTime,
    enable,
    changeTime,
    disable,
  }
}

async function save(subscription: PushSubscription, remindAt: string) {
  const { p256dh, auth } = subscription.toJSON().keys ?? {}
  if (!p256dh || !auth) {
    throw new Error('This browser gave no push keys.')
  }
  await savePushSubscription({
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    remindAt,
    deviceZone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
  })
}
