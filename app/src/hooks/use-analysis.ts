import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { analyzeSolution, configureEngine } from '@/engine/pipeline.js'
import type { AnalysisResult } from '@/lib/types'

export interface LogLine {
  at: string
  message: string
  error: boolean
}

export interface RateLimit {
  remaining: number
  limit: number
  reset: number | null
}

export type Status = 'idle' | 'loading' | 'done' | 'error'

export function useAnalysis(settings: { repo: string; branch: string; token: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [phase, setPhase] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogLine[]>([])
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null)
  const [current, setCurrent] = useState('')
  const running = useRef(false)

  const run = useCallback(
    async (solution: string) => {
      if (running.current || !solution) return
      const [owner, repo] = settings.repo.split('/')
      if (!owner || !repo) {
        toast.error('Repository must look like owner/repo')
        return
      }
      running.current = true
      setCurrent(solution)
      setStatus('loading')
      setError(null)
      setProgress({ done: 0, total: 0 })
      setPhase('Listing files')
      setLogs([])
      const toastId = toast.loading(`Analysing ${solution}…`)

      configureEngine({
        token: settings.token,
        log: (message, isError) =>
          setLogs((prev) => [...prev.slice(-400), { at: new Date().toLocaleTimeString(), message, error: isError }]),
        progress: (done, total) => {
          setPhase('Fetching files')
          setProgress({ done, total })
        },
        rateLimit: setRateLimit,
      })

      try {
        const next = await analyzeSolution({ owner, repo, branch: settings.branch, solution })
        setPhase('Done')
        setResult(next)
        setStatus('done')

        toast.success('Visualization complete', {
          id: toastId,
          description: `${solution} · ${next.analysis.label}`,
        })
        if (next.analysis.lowConfidence) {
          toast.warning('Low confidence classification', {
            description: `${Math.round(next.analysis.confidence * 100)}% — manual review recommended.`,
          })
        }
        const inv = next.inventory
        if (inv && (inv.failed > 0 || inv.truncated)) {
          toast.warning('Partial inventory', {
            description: `${inv.fetched} of ${inv.expected} files analysed${inv.truncated ? ' (GitHub listing truncated)' : ''}.`,
          })
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        setError(message)
        setStatus('error')
        toast.error('Visualization failed', { id: toastId, description: message })
      } finally {
        running.current = false
      }
    },
    [settings.repo, settings.branch, settings.token],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setError(null)
    setLogs([])
    setCurrent('')
    setProgress({ done: 0, total: 0 })
  }, [])

  return { status, progress, phase, result, error, logs, rateLimit, current, run, reset }
}
