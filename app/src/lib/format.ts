export const plural = (n: number, word: string, many?: string) => `${n} ${n === 1 ? word : (many ?? word + 's')}`

export const prettyTactic = (t: string) => String(t || '').replace(/([a-z])([A-Z])/g, '$1 $2')

export const SEVERITY_ORDER = ['High', 'Medium', 'Low', 'Informational']

export const SEVERITY_STYLE: Record<string, string> = {
  High: 'bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-400',
  Medium: 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400',
  Low: 'bg-blue-500/15 text-blue-600 ring-blue-500/30 dark:text-blue-400',
  Informational: 'bg-slate-500/15 text-slate-600 ring-slate-500/30 dark:text-slate-300',
  Unknown: 'bg-slate-500/10 text-slate-500 ring-slate-500/20',
}

export const SEVERITY_BAR: Record<string, string> = {
  High: '#dc2626',
  Medium: '#d97706',
  Low: '#2563eb',
  Informational: '#64748b',
  Unknown: '#94a3b8',
}

/** Confidence colour: red < 60, amber < 80, green otherwise. */
export function confidenceTone(confidence: number): 'danger' | 'warning' | 'success' {
  if (confidence < 0.6) return 'danger'
  if (confidence < 0.8) return 'warning'
  return 'success'
}

export const TONE_CLASS = {
  danger: 'bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-400',
  warning: 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400',
  success: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400',
  info: 'bg-sky-500/15 text-sky-600 ring-sky-500/30 dark:text-sky-400',
  neutral: 'bg-muted text-muted-foreground ring-border',
} as const

export type Tone = keyof typeof TONE_CLASS

/** Architecture badge colour keyed by the engine's class names. */
export const ARCH_CLASS_TONE: Record<string, Tone> = {
  ccf: 'success',
  http: 'warning',
  legacy: 'info',
  none: 'neutral',
  unknown: 'neutral',
}

export const TRIGGER_COLOR: Record<string, string> = {
  'Sentinel incident': '#7c3aed',
  'Sentinel alert': '#db2777',
  'Sentinel entity (manual)': '#0891b2',
  'HTTP request': '#475569',
  Schedule: '#0d9488',
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
