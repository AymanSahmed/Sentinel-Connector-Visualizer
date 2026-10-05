import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, SearchX } from 'lucide-react'
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'
import { SeverityPill } from '@/components/shared/badges'
import { TableChips } from '@/components/shared/table-chip'
import { EmptyState } from '@/components/shared/empty-state'

interface Row {
  type: string
  name: string
  path: string
  severity?: string
  tables: string[]
}

const TYPES: { bucket: string; label: string; color: string }[] = [
  { bucket: 'connectors', label: 'Connector', color: '#0d9488' },
  { bucket: 'dcrs', label: 'DCR', color: '#2563eb' },
  { bucket: 'analytics', label: 'Analytics', color: '#7c3aed' },
  { bucket: 'hunting', label: 'Hunting', color: '#6366f1' },
  { bucket: 'workbooks', label: 'Workbook', color: '#0284c7' },
  { bucket: 'playbooks', label: 'Playbook', color: '#db2777' },
  { bucket: 'functions', label: 'Parser', color: '#14b8a6' },
  { bucket: 'watchlists', label: 'Watchlist', color: '#d97706' },
  { bucket: 'notebooks', label: 'Notebook', color: '#ca8a04' },
  { bucket: 'infra', label: 'Function infra', color: '#ea580c' },
  { bucket: 'deploy', label: 'Deployment', color: '#64748b' },
  { bucket: 'coreFiles', label: 'Core file', color: '#475569' },
  { bucket: 'others', label: 'Other', color: '#94a3b8' },
]
const TYPE_COLOR = Object.fromEntries(TYPES.map((t) => [t.label, t.color]))

function friendlyName(it: any, raw: any, path: string): string {
  const candidates = [
    it.name, it.title, raw.properties?.connectorUiConfig?.title, raw.connectorUiConfig?.title, raw.title,
    raw.properties?.displayName, raw.displayName, raw.name, it.id,
  ].filter((v) => typeof v === 'string' && v.trim() && !/^\[?(concat|parameters|variables)\(/.test(v.trim()) && !/^\{\{.*\}\}/.test(v.trim()))
  return String(candidates[0] ?? path.split('/').pop() ?? '(unnamed)')
}

function toRows(artifacts: Record<string, any[]>): Row[] {
  return TYPES.flatMap(({ bucket, label }) =>
    (artifacts?.[bucket] ?? []).map((it: any): Row => {
      const path = String(it.path ?? '')
      const raw = it.raw ?? {}
      const tables = [it.tables, it.outputTables, it.dataTypes].find((x) => Array.isArray(x) && x.length && typeof x[0] === 'string') as string[] | undefined
      return {
        type: label,
        name: friendlyName(it, raw, path),
        path,
        severity: it.severity ?? raw.severity ?? raw.properties?.severity,
        tables: tables ?? [],
      }
    }),
  )
}

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => {
      const t = getValue<string>()
      return (
        <Badge variant="outline" className="rounded-full border-0 ring-1 ring-inset" style={{ color: TYPE_COLOR[t], backgroundColor: `${TYPE_COLOR[t]}18` }}>
          {t}
        </Badge>
      )
    },
  },
  { accessorKey: 'name', header: 'Name', cell: ({ getValue }) => <span className="block max-w-md font-medium break-words whitespace-normal">{getValue<string>()}</span> },
  {
    id: 'detail',
    header: 'Details',
    accessorFn: (r) => `${r.severity ?? ''} ${r.tables.join(' ')}`,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        {row.original.severity && <SeverityPill severity={row.original.severity} />}
        {row.original.tables.length > 0 && <TableChips names={row.original.tables} max={3} />}
      </div>
    ),
  },
  { accessorKey: 'path', header: 'File', cell: ({ getValue }) => <span className="text-muted-foreground block max-w-xs font-mono text-xs break-all whitespace-normal">{getValue<string>()}</span> },
]

export function ArtifactTable({ artifacts }: { artifacts: Record<string, any[]> }) {
  const data = useMemo(() => toRows(artifacts), [artifacts])
  const [sorting, setSorting] = useState<SortingState>([])
  const [filter, setFilter] = useState('')
  const [types, setTypes] = useState<string[]>([])

  const counts = useMemo(() => data.reduce<Record<string, number>>((m, r) => ((m[r.type] = (m[r.type] ?? 0) + 1), m), {}), [data])
  const rows = useMemo(() => (types.length ? data.filter((r) => types.includes(r.type)) : data), [data, types])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })
  const shown = table.getRowModel().rows

  return (
    <div className="space-y-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search name, file, table, severity…" className="pl-8" />
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">{shown.length} of {data.length} artifacts</span>
      </div>
      <ToggleGroup type="multiple" variant="outline" size="sm" value={types} onValueChange={setTypes} className="flex-wrap justify-start">
        {TYPES.filter((t) => counts[t.label]).map((t) => (
          <ToggleGroupItem key={t.label} value={t.label} className="gap-1.5">
            <i className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
            <span className="text-muted-foreground tabular-nums">{counts[t.label]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Card className="overflow-hidden p-0">
        <div className="max-h-[calc(100vh-18rem)] overflow-auto">
          <Table>
            <TableHeader className="bg-card sticky top-0 z-10 shadow-[0_1px_0_var(--border)]">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => {
                    const dir = h.column.getIsSorted()
                    const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
                    return (
                      <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className={h.column.getCanSort() ? 'cursor-pointer select-none' : undefined}>
                        <span className="inline-flex items-center gap-1">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getCanSort() && <Icon className="text-muted-foreground size-3" />}
                        </span>
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id}>
                  {r.getVisibleCells().map((c) => <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!shown.length && <EmptyState icon={SearchX} title="No artifacts match" description="Clear the search or type filters." className="m-4" />}
        </div>
      </Card>
    </div>
  )
}
