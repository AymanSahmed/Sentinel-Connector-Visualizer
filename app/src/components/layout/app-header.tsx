import { useEffect } from 'react'
import { useTheme } from '@/components/theme-provider'
import { Download, Loader2, Monitor, Moon, RefreshCw, Search, Settings2, Sun, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { RateLimit, Status } from '@/hooks/use-analysis'

export interface Settings {
  repo: string
  branch: string
}

export function AppHeader({
  settings,
  onSettingsChange,
  token,
  onTokenChange,
  current,
  solutionCount,
  status,
  progress,
  phase,
  rateLimit,
  onOpenPicker,
  onVisualize,
  onReloadSolutions,
  onExport,
  canExport,
}: {
  settings: Settings
  onSettingsChange: (s: Settings) => void
  token: string
  onTokenChange: (t: string) => void
  current: string
  solutionCount: number
  status: Status
  progress: { done: number; total: number }
  phase: string
  rateLimit: RateLimit | null
  onOpenPicker: () => void
  onVisualize: () => void
  onReloadSolutions: () => void
  onExport: () => void
  canExport: boolean
}) {
  const { theme, setTheme } = useTheme()
  const loading = status === 'loading'
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenPicker()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpenPicker])

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <img src="favicon.svg" alt="" className="size-7" />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold tracking-tight">Sentinel Solution Visualizer</p>
            <p className="text-muted-foreground text-[11px]">Understand any Microsoft Sentinel solution at a glance</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenPicker}
          className="bg-muted/50 hover:bg-muted text-muted-foreground mx-auto flex h-9 w-full max-w-xl min-w-0 items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors"
        >
          <Search className="size-4 shrink-0" />
          <span className={current ? 'text-foreground truncate font-medium' : 'truncate'}>
            {current || `Search ${solutionCount || ''} solutions…`}
          </span>
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {rateLimit && (
            <Badge variant="outline" className="hidden font-mono text-[10px] lg:inline-flex" title="GitHub API rate limit">
              API {rateLimit.remaining}/{rateLimit.limit}
            </Badge>
          )}

          <Button onClick={onVisualize} disabled={!current || loading} size="sm" className="gap-1.5">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {loading ? 'Analysing…' : 'Visualize'}
          </Button>

          <Button variant="outline" size="icon-sm" onClick={onExport} disabled={!canExport} aria-label="Export insights JSON">
            <Download className="size-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Repository settings">
                <Settings2 className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="repo">GitHub repository</Label>
                <Input id="repo" value={settings.repo} onChange={(e) => onSettingsChange({ ...settings, repo: e.target.value.trim() })} placeholder="owner/repo" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="branch">Branch</Label>
                <Input id="branch" value={settings.branch} onChange={(e) => onSettingsChange({ ...settings, branch: e.target.value.trim() })} placeholder="master" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token">GitHub token (optional)</Label>
                <Input id="token" type="password" value={token} onChange={(e) => onTokenChange(e.target.value)} placeholder="ghp_…" autoComplete="off" />
                <p className="text-muted-foreground text-[11px]">Raises the API limit from 60 to 5,000 requests/hour. Kept in this tab only.</p>
              </div>
              <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={onReloadSolutions}>
                <RefreshCw className="size-3.5" /> Reload solution list
              </Button>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Change theme">
                <ThemeIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading && (
        <div className="bg-muted/40 flex items-center gap-3 border-t px-4 py-1.5">
          <span className="text-muted-foreground w-44 shrink-0 text-xs">
            {phase}
            {progress.total > 0 && ` · ${progress.done}/${progress.total} files`}
          </span>
          {progress.total > 0 ? <Progress value={pct} className="h-1.5" /> : <Progress value={25} className="h-1.5 animate-pulse" />}
          <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{progress.total ? `${pct}%` : ''}</span>
        </div>
      )}
    </header>
  )
}
