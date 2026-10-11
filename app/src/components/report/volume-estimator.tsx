import { useMemo, useState } from 'react'
import { ClipboardCopy, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { INS_VOLUME_UNITS, insEstimateVolume, insVolumeKql, insVolumeRows } from '@/engine/pipeline.js'
import type { Insights, VolumeRow } from '@/lib/types'
import { cn } from '@/lib/utils'

const UNITS = INS_VOLUME_UNITS

function fmt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n >= 100) return Math.round(n).toLocaleString()
  if (n >= 10) return n.toFixed(1)
  if (n >= 1) return n.toFixed(2)
  return n >= 0.01 ? n.toFixed(3) : '<0.01'
}

const toNumber = (value: string) => Math.max(0, Number(value) || 0)

/** Planning aid: scales editable per-table profiles by the size of the customer's environment. */
export function VolumeEstimator({ insights }: { insights: Insights }) {
  const [units, setUnits] = useState<Record<string, number>>({ users: 1000, devices: 500, sources: 10 })
  const [rows, setRows] = useState<VolumeRow[]>(() => insVolumeRows(insights))

  const estimate = useMemo(() => insEstimateVolume(rows, units), [rows, units])
  const kql = useMemo(() => insVolumeKql(rows.map((r) => r.table)), [rows])

  if (!rows.length) return <Card className="text-muted-foreground p-5 text-sm">This solution ingests no tables, so there is no volume to estimate.</Card>

  const update = (index: number, patch: Partial<VolumeRow>) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  const range = estimate.range

  return (
    <Card className="gap-4 p-5">
      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        Planning estimate only — the repository does not state data volume. Enter your environment size, adjust the editable per-table assumptions, then validate with the KQL below or a short pilot.
      </p>

      <div className="flex flex-wrap gap-4">
        {Object.entries(UNITS).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`vol-${key}`}>{label}</Label>
            <Input id={`vol-${key}`} type="number" min={0} className="w-32" value={units[key]} onChange={(e) => setUnits((prev) => ({ ...prev, [key]: toNumber(e.target.value) }))} />
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['low', 'likely', 'high'] as const).map((k) => (
          <div key={k} className={cn('rounded-xl border p-3', k === 'likely' && 'bg-muted/50')}>
            <p className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">{k}</p>
            <p className="text-2xl font-extrabold tabular-nums">
              {fmt(range[k].gbPerDay)} <span className="text-xs font-semibold">GB/day</span>
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {fmt(range[k].gbPerMonth)} GB/month · {fmt(range[k].eps)} EPS
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead>Scales with</TableHead>
              <TableHead>Events / unit / day</TableHead>
              <TableHead>Avg bytes / event</TableHead>
              <TableHead className="text-right">Likely EPS</TableHead>
              <TableHead className="text-right">Likely GB / day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimate.rows.map((r, i) => (
              <TableRow key={r.table}>
                <TableCell>
                  <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">{r.table}</code>
                  {!r.matched && <span className="text-muted-foreground ml-1.5 text-[11px]">generic profile</span>}
                  <p className="text-muted-foreground mt-0.5 text-[11px]">{r.note}</p>
                </TableCell>
                <TableCell>
                  <Select value={r.unit} onValueChange={(unit) => update(i, { unit })}>
                    <SelectTrigger size="sm" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(UNITS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input type="number" min={0} className="w-28" value={r.eventsPerUnitPerDay} onChange={(e) => update(i, { eventsPerUnitPerDay: toNumber(e.target.value) })} />
                </TableCell>
                <TableCell>
                  <Input type="number" min={0} className="w-24" value={r.bytes} onChange={(e) => update(i, { bytes: toNumber(e.target.value) })} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmt(r.eps)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmt(r.gbPerDay)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="text-primary text-sm font-medium">Measure real volume (KQL)</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigator.clipboard.writeText(kql).then(() => toast.success('KQL copied'))}
          >
            <ClipboardCopy className="size-3.5" /> Copy KQL
          </Button>
          <pre className="bg-muted overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">{kql}</pre>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
