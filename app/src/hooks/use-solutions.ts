import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { configureEngine, listSolutions } from '@/engine/pipeline.js'

const TTL_MS = 6 * 60 * 60 * 1000

/** Loads the solution catalogue of a repo; cached for six hours to spare the GitHub rate limit. */
export function useSolutions(repo: string, branch: string, token: string) {
  const [solutions, setSolutions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const tokenRef = useRef(token)
  tokenRef.current = token

  const load = useCallback(
    async (force: boolean) => {
      const [owner, name] = repo.split('/')
      if (!owner || !name) return
      const cacheKey = `scv.solutions.${repo}@${branch}`
      if (!force) {
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
          if (cached && Date.now() - cached.at < TTL_MS && cached.items?.length) {
            setSolutions(cached.items)
            setError(null)
            return
          }
        } catch {
          /* ignore corrupt cache */
        }
      }
      const id = ++requestId.current
      setLoading(true)
      setError(null)
      try {
        configureEngine({ token: tokenRef.current })
        const items = await listSolutions(owner, name, branch)
        if (id !== requestId.current) return
        setSolutions(items)
        localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), items }))
        if (force) toast.success(`Loaded ${items.length} solutions`)
      } catch (e) {
        if (id !== requestId.current) return
        const message = e instanceof Error ? e.message : String(e)
        setError(message)
        toast.error('Could not list solutions', { description: message })
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [repo, branch],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  return { solutions, loading, error, reload: () => load(true) }
}
