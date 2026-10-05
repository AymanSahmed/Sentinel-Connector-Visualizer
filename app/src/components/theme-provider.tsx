import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

const KEY = 'scv.theme'
const Ctx = createContext<{ theme: Theme; resolvedTheme: 'light' | 'dark'; setTheme: (t: Theme) => void }>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
})

const systemTheme = () => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

/** Minimal class-based theme switch (light / dark / system). The `dark` class is also set before first paint from index.html. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) || 'system')
  const [system, setSystem] = useState<'light' | 'dark'>(systemTheme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSystem(systemTheme())
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolvedTheme = theme === 'system' ? system : theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(KEY, t)
    setThemeState(t)
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
