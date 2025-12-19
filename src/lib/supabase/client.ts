import { createBrowserClient } from '@supabase/ssr'

const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]
const authStorageKey = projectRef ? `sb-${projectRef}-auth-token` : undefined

function clearStaleSession() {
  try {
    if (authStorageKey && typeof window !== 'undefined') {
      localStorage.removeItem(authStorageKey)
    }
  } catch (err) {
    console.warn('[supabase] failed to clear stale session', err)
  }
}

export function createClient() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        async fetch(input, init) {
          const response = await fetch(input, init)

          // If Supabase refresh fails with an invalid refresh token, clear local session to recover
          try {
            if (
              typeof input === 'string' &&
              input.includes('/auth/v1/token') &&
              response.status === 400
            ) {
              const clone = response.clone()
              const body = await clone.json().catch(() => null)
              if (body?.code === 'refresh_token_not_found') {
                clearStaleSession()
              }
            }
          } catch (err) {
            console.warn('[supabase] auth fetch inspect failed', err)
          }

          return response
        },
      },
    }
  )

  return supabase
}
