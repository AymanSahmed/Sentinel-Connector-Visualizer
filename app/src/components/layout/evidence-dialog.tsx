import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ToneBadge } from '@/components/shared/badges'
import type { ArchitectureAnalysis } from '@/lib/types'
import type { Tone } from '@/lib/format'

const SIDE_TONE: Record<string, Tone> = { CCF: 'success', HTTP: 'warning', LEGACY: 'info' }

/** Line-level detection evidence: every pattern hit with its file and line. */
export function EvidenceDialog({ analysis, open, onOpenChange }: { analysis: ArchitectureAnalysis; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [side, setSide] = useState('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return analysis.findings.filter(
      (f) => (side === 'all' || f.side === side) && (!q || `${f.pattern} ${f.file} ${f.lineText}`.toLowerCase().includes(q)),
    )
  }, [analysis.findings, side, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Detection evidence</DialogTitle>
          <DialogDescription>
            {rows.length} of {analysis.findings.length} pattern matches that drove the architecture verdict.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" value={side} onValueChange={(v) => setSide(v || 'all')} variant="outline" size="sm">
            {['all', 'CCF', 'HTTP', 'LEGACY'].map((s) => (
              <ToggleGroupItem key={s} value={s} className="px-3 text-xs">
                {s === 'all' ? 'All' : s}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="relative min-w-52 flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by pattern, file or snippet…" className="pl-8" />
          </div>
        </div>
        <ScrollArea className="h-[55vh] rounded-lg border">
          <ul className="divide-y">
            {rows.slice(0, 400).map((f, i) => (
              <li key={i} className="space-y-1 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge tone={SIDE_TONE[f.side] ?? 'neutral'}>{f.side}</ToneBadge>
                  <span className="font-mono font-semibold">{f.pattern}</span>
                  <span className="text-muted-foreground font-mono break-all">
                    {f.file}:{f.line}
                  </span>
                </div>
                <code className="bg-muted text-muted-foreground block rounded px-2 py-1 break-all">{f.lineText}</code>
              </li>
            ))}
            {!rows.length && <li className="text-muted-foreground p-6 text-center text-sm">No matches.</li>}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
