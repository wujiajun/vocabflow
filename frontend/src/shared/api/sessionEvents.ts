type TokenRejectedListener = (rejectedToken: string) => void

const listeners = new Set<TokenRejectedListener>()

// The API client reports every 401 it receives for a request that carried a token, so the auth
// layer can end the session without each feature handling it. The rejected token travels with the
// event so a late response for an old token cannot end a newer session.
export function onTokenRejected(listener: TokenRejectedListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyTokenRejected(rejectedToken: string) {
  listeners.forEach((listener) => listener(rejectedToken))
}
