// A new build gets new file names, so the script named in the page the server serves now tells
// whether the page that is open is out of date. This is a plain request for the page itself, not an
// API call, so it does not go through the API client.
const bundlePattern = /<script[^>]*\ssrc="([^"]*\/assets\/[^"]+\.js)"/

// The built script this page was loaded with; none while developing, where the scripts are not hashed.
export function loadedBundle() {
  const script = Array.from(document.querySelectorAll('script[src]')).find((element) =>
    /\/assets\/[^/]+\.js$/.test(element.getAttribute('src') ?? ''),
  )
  return script?.getAttribute('src') ?? null
}

// The script the server's page names now, or null if that could not be read.
export async function latestBundle(): Promise<string | null> {
  try {
    const response = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } })
    if (!response.ok) {
      return null
    }
    return bundlePattern.exec(await response.text())?.[1] ?? null
  } catch {
    return null
  }
}
