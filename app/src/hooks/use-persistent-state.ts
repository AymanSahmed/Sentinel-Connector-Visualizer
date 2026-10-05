import { useCallback, useEffect, useState } from 'react'

/** useState persisted in localStorage (or sessionStorage for secrets). */
export function usePersistentState<T>(key: string, initial: T, storage: 'local' | 'session' = 'local') {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key)
      return raw == null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      ;(storage === 'local' ? window.localStorage : window.sessionStorage).setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable */
    }
  }, [key, value, storage])

  const set = useCallback((next: T | ((prev: T) => T)) => setValue(next), [])
  return [value, set] as const
}
