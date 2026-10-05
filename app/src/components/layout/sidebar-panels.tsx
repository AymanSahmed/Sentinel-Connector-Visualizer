import { useState } from 'react'
import { AlertTriangle, ClipboardCopy, FileSearch, Info, ScrollText, ShieldCheck, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfidenceBadge, MethodBadge, ToneBadge } from '@/components/shared/badges'
import { EmptyState } from '@/components/shared/empty-state'
import { EvidenceDialog } from './evidence-dialog'
import type { LogLine, Status } from '@/hooks/use-analysis'
import type { AnalysisResult } from '@/lib/types'
import { ARCH_CLASS_TONE } from '@/lib/format'
import { INS_ARCH_CATEGORIES } from '@/engine/pipeline.js'
import { cn } from '@/lib/utils'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-start gap-2 text-xs">
      <span className="text-muted-foreground pt-0.5 font-medium">{label}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}

function MetaPanel({ result }: { result: AnalysisResult }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const { analysis, insights, meta } = result
  const sum = (k: 'ccfScore' | 'httpScore') => analysis.connectors.reduce((s, c) => s + (c[k] || 0), 0)
  const methodMix = Object.entries(
    insights.connectors.reduce<Record<string, number>>((m, c) => ((m[c.method.primary] = (m[c.method.primary] || 0) + 1), m), {}),
  )
  const core = (analysis.core ?? {}) as Record<string, unknown>
  const packaging = (core.packaging ?? {}) as Record<string, boolean>
  const coreSignals = [
    packaging.dcrJson && 'dcr.json',
    packaging.connectorDefinition && 'connectorDefinition.json',
    packaging.pollerConfig && 'pollerConfig.json',
    core.dcrResource && 'DCR resource',
    core.dceResource && 'DCE resource',
    core.httpApiLogs && '/api/logs',
    core.workspaceKeyPair && 'workspaceId + sharedKey',
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <ToneBadge tone={ARCH_CLASS_TONE[analysis.primaryClass ?? 'unknown'] ?? 'neutral'} className="h-auto px-3 py-1 text-sm font-bold whitespace-normal">
          {analysis.label}
        </ToneBadge>
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceBadge confidence={analysis.confidence} />
        </div>
        {analysis.lowConfidence && (
          <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Low confidence — manual review recommended.</span>
          </div>
        )}
      </div>

      {methodMix.length > 0 && (
        <Row label="Collection">
          <div className="flex flex-wrap gap-1.5">
            {methodMix.map(([k, n]) => (
              <span key={k} className="inline-flex items-center gap-1">
                <MethodBadge method={k} />
                {n > 1 && <span className="text-muted-foreground text-xs font-semibold">×{n}</span>}
              </span>
            ))}
          </div>
        </Row>
      )}
      <Row label="Solution">{meta.solutionName || result.solution}</Row>
      {insights.solution.publisher && <Row label="Publisher">{insights.solution.publisher}</Row>}
      {meta.categories?.length > 0 && (
        <Row label="Categories">
          <div className="flex flex-wrap gap-1">
            {meta.categories.slice(0, 6).map((c) => (
              <Badge key={c} variant="secondary">
                {c}
              </Badge>
            ))}
          </div>
        </Row>
      )}
      {meta.domains?.length > 0 && (
        <Row label="Domains">
          <div className="flex flex-wrap gap-1">
            {meta.domains.slice(0, 6).map((c) => (
              <Badge key={c} variant="outline">
                {c}
              </Badge>
            ))}
          </div>
        </Row>
      )}

      {analysis.connectors.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Connector</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right" title="Distinct CCF artifacts">
                  CCF
                </TableHead>
                <TableHead className="text-right" title="Legacy Data Collector API usage, counted once per connector">
                  HTTP
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.connectors.slice(0, 6).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-28 truncate" title={c.id}>
                    {c.id}
                  </TableCell>
                  <TableCell>{c.category ? INS_ARCH_CATEGORIES[c.category]?.label : '–'}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.ccfScore}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.httpScore}</TableCell>
                </TableRow>
              ))}
              {analysis.connectors.length > 6 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    +{analysis.connectors.length - 6} more
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell>Total ({analysis.connectors.length})</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{sum('ccfScore')}</TableCell>
                <TableCell className="text-right tabular-nums">{sum('httpScore')}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {coreSignals.length > 0 && (
        <Row label="Core signals">
          <div className="flex flex-wrap gap-1">
            {coreSignals.map((s) => (
              <Badge key={s} variant="outline" className="font-mono text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        </Row>
      )}

      <Row label="Reasoning">
        <ul className="list-disc space-y-0.5 pl-4">
          {analysis.reasoningLines.slice(0, 8).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Row>

      {analysis.findings.length > 0 && (
        <>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setEvidenceOpen(true)}>
            <FileSearch className="size-3.5" /> View line-level evidence ({analysis.findings.length})
          </Button>
          <EvidenceDialog analysis={analysis} open={evidenceOpen} onOpenChange={setEvidenceOpen} />
        </>
      )}
    </div>
  )
}

function OverviewPanel({ result }: { result: AnalysisResult }) {
  const { insights, artifacts } = result
  const flows =
    artifacts.dcrs.reduce((s: number, d: { flowsData?: unknown[] }) => s + (d.flowsData?.length ?? 0), 0) +
    artifacts.coreFiles.filter((c: { coreKind: string }) => c.coreKind === 'dcr').reduce((s: number, c: { flowsData?: unknown[] }) => s + (c.flowsData?.length ?? 0), 0)
  const items: [string, number][] = [
    ['Data connectors', insights.counts.connectors],
    ['DCRs', artifacts.dcrs.length],
    ['Data flows', flows],
    ['KQL functions', artifacts.functions.length],
    ['Tables', insights.counts.tables],
    ['Analytics rules', artifacts.analytics.length],
    ['Hunting queries', artifacts.hunting.length],
    ['Workbooks', artifacts.workbooks.length],
    ['Playbooks', artifacts.playbooks.length],
    ['Watchlists', artifacts.watchlists.length],
    ['Notebooks', artifacts.notebooks.length],
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, n]) => (
        <div key={label} className={cn('rounded-lg border px-3 py-2', n === 0 && 'opacity-60')}>
          <p className="text-lg leading-none font-bold tabular-nums">{n}</p>
          <p className="text-muted-foreground mt-1 text-[11px]">{label}</p>
        </div>
      ))}
    </div>
  )
}

function WizardPanel({ result }: { result: AnalysisResult }) {
  const { createUi, insights, meta } = result
  const c = insights.counts
  return (
    <div className="space-y-3">
      <Row label="Solution">{meta.solutionName || result.solution}</Row>
      {createUi?.description && <p className="text-muted-foreground text-xs">{createUi.description.slice(0, 240)}</p>}
      <Row label="Parsed">
        <span className="tabular-nums">
          {c.connectors} connectors · {c.workbooks} workbooks · {c.analytics} analytics · {c.hunting} hunting · {c.playbooks} playbooks
        </span>
      </Row>
      {createUi ? (
        <Row label={`Wizard (${createUi.steps})`}>
          <div className="flex flex-wrap gap-1">
            {createUi.stepNames.map((s, i) => (
              <Badge key={s} variant="secondary" className="gap-1">
                <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                {s}
              </Badge>
            ))}
          </div>
        </Row>
      ) : (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Info className="size-3.5" /> No createUiDefinition.json — packaged without a deployment wizard.
        </p>
      )}
    </div>
  )
}

function DiagnosticsPanel({ logs }: { logs: LogLine[] }) {
  if (!logs.length) return <p className="text-muted-foreground text-xs">Logs appear here while a solution is analysed.</p>
  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="xs"
        className="gap-1.5"
        onClick={() => {
          void navigator.clipboard?.writeText(logs.map((l) => `[${l.at}] ${l.message}`).join('\n'))
          toast.success('Diagnostics copied')
        }}
      >
        <ClipboardCopy /> Copy log
      </Button>
      <ScrollArea className="h-44 rounded-lg border">
        <div className="space-y-0.5 p-2 font-mono text-[10.5px] leading-snug">
          {logs.map((l, i) => (
            <div key={i} className={l.error ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
              <span className="opacity-60">{l.at}</span> {l.message}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

/** Left sidebar: collapsible panels so engineers can close what they do not need. */
export function SidebarPanels({ result, status, logs }: { result: AnalysisResult | null; status: Status; logs: LogLine[] }) {
  const loading = status === 'loading'

  if (!result) {
    return (
      <div className="space-y-3 p-3">
        {loading ? (
          <>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <EmptyState icon={ShieldCheck} title="No solution yet" description="Pick a solution to see the architecture verdict, signals and parsed artifacts here." className="py-8" />
        )}
        {logs.length > 0 && <DiagnosticsPanel logs={logs} />}
      </div>
    )
  }

  const panels = [
    { id: 'meta', title: 'Solution meta', icon: ShieldCheck, body: <MetaPanel result={result} /> },
    { id: 'overview', title: 'Design overview', icon: Workflow, body: <OverviewPanel result={result} /> },
    { id: 'wizard', title: 'Logic & wizard analysis', icon: ScrollText, body: <WizardPanel result={result} /> },
    { id: 'diagnostics', title: `Diagnostics (${logs.length})`, icon: FileSearch, body: <DiagnosticsPanel logs={logs} /> },
  ]

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      <Accordion type="multiple" defaultValue={['meta', 'overview']} className="px-3 py-1">
        {panels.map((p) => (
          <AccordionItem key={p.id} value={p.id}>
            <AccordionTrigger className="gap-2 text-sm">
              <span className="flex items-center gap-2">
                <p.icon className="text-primary size-4" />
                {p.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>{p.body}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
