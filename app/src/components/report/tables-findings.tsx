import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToneBadge } from '@/components/shared/badges'
import { TableChip } from '@/components/shared/table-chip'
import type { Insights } from '@/lib/types'
import { cn } from '@/lib/utils'

const Count = ({ list }: { list: string[] }) => (
  <TableCell className={cn('text-center font-semibold tabular-nums', !list.length && 'text-muted-foreground font-normal')} title={list.join('\n')}>
    {list.length || '–'}
  </TableCell>
)

export function TablesMatrix({ insights }: { insights: Insights }) {
  if (!insights.tables.length) return null
  return (
    <Card className="overflow-hidden p-0">
      <div className="max-h-[32rem] overflow-auto">
        <Table>
          <TableHeader className="bg-card sticky top-0 z-10 shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Ingested by</TableHead>
              <TableHead>Schema</TableHead>
              <TableHead className="text-center">Analytics</TableHead>
              <TableHead className="text-center">Hunting</TableHead>
              <TableHead className="text-center">Workbooks</TableHead>
              <TableHead className="text-center">Parsers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insights.tables.slice(0, 60).map((t) => (
              <TableRow key={t.name}>
                <TableCell><TableChip name={t.name} /></TableCell>
                <TableCell>
                  {t.producers.length ? (t.custom ? <ToneBadge tone="success">Custom table</ToneBadge> : <ToneBadge>Built-in table</ToneBadge>) : <ToneBadge tone="neutral">Queried only</ToneBadge>}
                </TableCell>
                <TableCell className="max-w-64 text-xs">{t.producers.length ? t.producers.join(', ') : <span className="text-muted-foreground">other solutions / Azure</span>}</TableCell>
                <TableCell className="text-xs">{t.schema ? `${t.schema.columns} columns${t.schema.plan ? ` · ${t.schema.plan}` : ''}` : <span className="text-muted-foreground">–</span>}</TableCell>
                <Count list={t.analytics} />
                <Count list={t.hunting} />
                <Count list={t.workbooks} />
                <Count list={t.parsers} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

const ICON = { info: Info, warn: AlertTriangle, good: CheckCircle2 }
const COLOR = { info: 'border-l-sky-500 text-sky-600 dark:text-sky-400', warn: 'border-l-amber-500 text-amber-600 dark:text-amber-400', good: 'border-l-emerald-500 text-emerald-600 dark:text-emerald-400' }

export function Findings({ insights }: { insights: Insights }) {
  if (!insights.findings.length) return null
  return (
    <ul className="space-y-2">
      {insights.findings.map((f, i) => {
        const Icon = ICON[f.level]
        return (
          <li key={i} className={cn('bg-card flex items-start gap-3 rounded-lg border border-l-4 px-4 py-2.5 text-sm', COLOR[f.level])}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="text-foreground">{f.text}</span>
          </li>
        )
      })}
    </ul>
  )
}
