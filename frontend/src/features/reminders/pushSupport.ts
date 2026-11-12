// Can this browser take a daily reminder, and if not, why not? The answer decides what Settings says.
export type PushSupport =
  // everything needed is there
  | 'ok'
  // a service worker and push only work on https (or localhost)
  | 'insecure'
  // an iPhone or iPad only offers push to an app added to the Home Screen
  | 'needs-install'
  | 'unsupported'

export function pushSupport(): PushSupport {
  if (!window.isSecureContext) {
    return 'insecure'
  }
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return 'ok'
  }
  return isApple() && !isInstalled() ? 'needs-install' : 'unsupported'
}

function isApple() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isInstalled() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

// The server's public key arrives as base64url text; subscribing wants the bytes.
export function keyToBytes(key: string) {
  const base64 = key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '=')
  const raw = atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}
