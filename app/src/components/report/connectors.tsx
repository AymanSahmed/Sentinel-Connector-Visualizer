import type { ReactNode } from 'react'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MethodBadge, ToneBadge } from '@/components/shared/badges'
import { DetailCard } from '@/components/shared/detail-card'
import { TableChips } from '@/components/shared/table-chip'
import { INS_METHODS } from '@/engine/pipeline.js'
import type { ConnectorInsight, Insights } from '@/lib/types'
import { cn } from '@/lib/utils'

const looksTechnical = (v: string) => /^(https?:|‹|\/|\{|[A-Za-z0-9_.-]+\/)|[‹›]|\.[a-z]{2,}\//i.test(v)

function Stage({ title, color, children, last }: { title: string; color: string; children: ReactNode; last?: boolean }) {
  return (
    <div className="bg-muted/30 relative flex min-w-0 flex-col gap-2 rounded-xl border p-3">
      <h4 className="flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-widest uppercase" style={{ color }}>
        <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
        {title}
      </h4>
      {children}
      {!last && (
        <span className="absolute top-1/2 -right-[19px] z-10 hidden size-6 -translate-y-1/2 place-items-center rounded-full text-white shadow lg:grid" style={{ backgroundColor: color }}>
          <ArrowRight className="size-3.5" />
        </span>
      )}
    </div>
  )
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="text-xs">
      <span className="text-muted-foreground block text-[10px] font-semibold tracking-wide uppercase">{label}</span>
      {children}
    </div>
  )
}

const Code = ({ children }: { children: ReactNode }) => <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px] break-all">{children}</code>

function SourceStage({ c }: { c: ConnectorInsight }) {
  return (
    <>
      <p className="text-sm leading-tight font-semibold break-words">{c.source.title}</p>
      {c.source.lines.slice(0, 5).map((l, i) => (
        <Line key={i} label={l.label}>
          {looksTechnical(l.value) ? <Code>{l.value}</Code> : l.value}
          {l.meta && <span className="text-muted-foreground ml-1">{l.meta}</span>}
        </Line>
      ))}
      {c.source.lines.length > 5 && <p className="text-muted-foreground text-xs">+{c.source.lines.length - 5} more</p>}
      {c.source.note && <p className="text-muted-foreground text-[11px] italic">ⓘ {c.source.note}</p>}
    </>
  )
}

function CollectionStage({ c }: { c: ConnectorInsight }) {
  const m = c.methodInfo
  return (
    <>
      <MethodBadge method={c.method.primary} className="self-start" />
      <p className="text-muted-foreground text-xs">{m.sub}</p>
      <Line label="Hosting">{m.hosting}</Line>
      {c.schedule.windowMin && (
        <Line label="Schedule">
          Polls every {c.schedule.windowMin} min{c.schedule.paging.length ? ` · paging: ${c.schedule.paging.join(', ')}` : ''}
        </Line>
      )}
      {c.method.primary === 'function' && <Line label="Runs as">Timer-triggered Function App</Line>}
      {c.auth.length > 0 && <Line label="Authentication">{c.auth.join(', ')}</Line>}
    </>
  )
}

function IngestStage({ c }: { c: ConnectorInsight }) {
  const p = c.method.primary
  if (['ccf-pull', 'ccf-push', 'ccf-cloud', 'logs-ingestion'].includes(p))
    return (
      <>
        {c.hasDce && <Line label="Endpoint">Data Collection Endpoint (DCE)</Line>}
        <Line label="Rule">
          {c.dcrs.length ? (
            <span className="flex flex-wrap gap-1">{c.dcrs.map((d) => <Code key={d.id}>{d.id}</Code>)}</span>
          ) : (
            'Data Collection Rule (created at deploy)'
          )}
        </Line>
        <Line label="Transform">{c.hasTransform ? 'Ingestion-time KQL transform' : 'None / pass-through'}</Line>
      </>
    )
  if (p === 'function')
    return (
      <>
        <Line label="Writes via">{c.method.functionIngestion || 'Log Analytics ingestion'}</Line>
        {c.dcrs.length > 0 && <Line label="Rule"><span className="flex flex-wrap gap-1">{c.dcrs.map((d) => <Code key={d.id}>{d.id}</Code>)}</span></Line>}
      </>
    )
  if (p === 'http-collector') return <Line label="Writes via">HTTP Data Collector API <Code>/api/logs</Code> + workspace key</Line>
  if (p === 'agent') return <Line label="Writes via">Azure Monitor Agent + Data Collection Rule</Line>
  if (p === 'native') return <Line label="Writes via">Built-in Sentinel connection — no DCR to manage</Line>
  return <p className="text-muted-foreground text-xs">Not visible in repository files.</p>
}

export function ConnectorCard({ c, index }: { c: ConnectorInsight; index: number }) {
  const m = c.methodInfo
  const consumers: [number, string, string][] = [
    [c.consumers.analytics, '🔍', 'analytics rules'],
    [c.consumers.hunting, '🎯', 'hunting queries'],
    [c.consumers.workbooks, '📊', 'workbooks'],
    [c.consumers.parsers, 'ƒ', 'parsers'],
  ]
  const prereq = [...c.prerequisites.permissions.map((t) => ({ n: '', t })), ...c.prerequisites.customs.map((x) => ({ n: x.name, t: x.text }))]

  return (
    <Card id={`conn-${index}`} className="gap-4 border-t-4 p-5" style={{ borderTopColor: m.color }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <MethodBadge method={c.method.primary} />
        <h3 className="text-lg font-semibold">{c.name}</h3>
        {c.publisher && <span className="text-muted-foreground text-xs">by {c.publisher}</span>}
        {c.isPreview && <ToneBadge tone="warning">Preview</ToneBadge>}
        {c.legacy && <ToneBadge tone="warning">Legacy</ToneBadge>}
        {c.method.keys.filter((k) => k !== c.method.primary && k !== 'logs-ingestion').map((k) => (
          <Badge key={k} variant="outline" style={{ color: INS_METHODS[k].color, borderColor: INS_METHODS[k].color }}>
            also: {INS_METHODS[k].label}
          </Badge>
        ))}
      </div>

      <p className="rounded-lg border px-3 py-2 text-sm" style={{ backgroundColor: `${m.color}14`, borderColor: `${m.color}40` }}>
        <b>{m.label}:</b> {m.how}
      </p>
      {c.description && <p className="text-muted-foreground text-sm">{c.description.slice(0, 420)}{c.description.length > 420 ? '…' : ''}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr_1fr_1fr_.9fr]">
        <Stage title="Source" color="#0d9488"><SourceStage c={c} /></Stage>
        <Stage title="Collection" color={m.color}><CollectionStage c={c} /></Stage>
        <Stage title="Ingestion" color="#2563eb"><IngestStage c={c} /></Stage>
        <Stage title="Log Analytics tables" color="#0891b2">
          {c.tables.length ? <TableChips names={c.tables} max={6} /> : <p className="text-muted-foreground text-xs">No table names declared.</p>}
          {c.tablesInferred && <p className="text-muted-foreground text-[11px]">inferred from the tables this solution’s content queries</p>}
        </Stage>
        <Stage title="Used by" color="#7c3aed" last>
          {consumers.some(([n]) => n) ? (
            consumers.filter(([n]) => n).map(([n, icon, label]) => (
              <p key={label} className="text-xs">
                <b className="text-sm">{n}</b> {icon} {label}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground text-xs">No shipped content queries these tables.</p>
          )}
        </Stage>
      </div>

      {(c.inputs.length > 0 || prereq.length > 0 || c.pollers.length > 1) && (
        <div className="grid gap-4 text-sm md:grid-cols-3">
          {c.inputs.length > 0 && (
            <div>
              <h5 className="text-muted-foreground mb-1 text-[10.5px] font-bold tracking-widest uppercase">You will be asked for</h5>
              <ul className="list-disc pl-4 text-xs">{c.inputs.slice(0, 8).map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          )}
          {prereq.length > 0 && (
            <div>
              <h5 className="text-muted-foreground mb-1 text-[10.5px] font-bold tracking-widest uppercase">Prerequisites</h5>
              <ul className="list-disc pl-4 text-xs">{prereq.slice(0, 6).map((p, i) => <li key={i}>{p.n && <b>{p.n} — </b>}{p.t}</li>)}</ul>
            </div>
          )}
          {c.pollers.length > 1 && (
            <div>
              <h5 className="text-muted-foreground mb-1 text-[10.5px] font-bold tracking-widest uppercase">Event streams polled</h5>
              <ul className="list-disc pl-4 text-xs">{c.pollers.slice(0, 8).map((p) => <li key={p.url}><b>{p.label}</b> → <Code>{p.table}</Code></li>)}</ul>
            </div>
          )}
        </div>
      )}

      <Collapsible>
        <CollapsibleTrigger className="text-primary group flex items-center gap-1 text-sm font-medium">
          <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
          Why was it classified as “{m.label}”? (detection evidence)
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {c.method.found.length ? (
            c.method.found.map((f, i) => (
              <div key={i} className="rounded-lg border p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <MethodBadge method={f.key} />
                  <ToneBadge tone={f.strength === 'strong' ? 'success' : 'warning'}>{f.strength}</ToneBadge>
                  <span>{f.why}</span>
                </div>
                {f.evidence?.map((v, j) => (
                  <code key={j} className="text-muted-foreground mt-1 block break-all">
                    {v.file} {v.where && `· ${v.where}`} {v.snippet && `→ ${v.snippet}`}
                  </code>
                ))}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-xs">No collection signals were found.</p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="text-primary group flex items-center gap-1 text-sm font-medium">
          <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
          Files in this connector package ({c.files.length})
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-0.5">
          {c.files.map((f) => <Code key={f}>{f}</Code>)}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

export function MethodsLegend({ insights }: { insights: Insights }) {
  const keys = [...new Set(insights.connectors.flatMap((c) => [c.method.primary, ...c.method.keys]))]
  if (!keys.length) return null
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="text-primary group flex items-center gap-1 text-sm font-medium">
        <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
        What do these collection methods mean?
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {keys.map((k) => (
          <div key={k} className="rounded-lg border-l-4 bg-muted/40 p-3 text-xs" style={{ borderLeftColor: INS_METHODS[k].color }}>
            <b className="mb-0.5 block" style={{ color: INS_METHODS[k].color }}>
              {INS_METHODS[k].icon} {INS_METHODS[k].label}
            </b>
            {INS_METHODS[k].how}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ConnectorOverview({ insights }: { insights: Insights }) {
  if (insights.connectors.length < 2) return null
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Connector</TableHead>
            <TableHead>Collection method</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Tables</TableHead>
            <TableHead>Azure Function</TableHead>
            <TableHead>Auth</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {insights.connectors.map((c, i) => (
            <TableRow key={`${c.name}-${i}`}>
              <TableCell className="max-w-72 font-medium">
                <DetailCard
                  trigger={
                    <a
                      href={`#conn-${i}`}
                      onClick={(e) => {
                        e.preventDefault()
                        document.getElementById(`conn-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className="text-primary hover:underline"
                    >
                      {c.name}
                    </a>
                  }
                  title={c.name}
                  subtitle={c.methodInfo.label}
                  accent={c.methodInfo.color}
                  sections={[
                    { label: 'Method', value: c.methodInfo.sub },
                    { label: 'Hosting', value: c.methodInfo.hosting },
                    { label: 'Source', value: c.source.title },
                    { label: 'Tables', value: c.tables.join(', ') },
                    { label: 'Auth', value: c.auth.join(', ') },
                  ]}
                />
              </TableCell>
              <TableCell><MethodBadge method={c.method.primary} /></TableCell>
              <TableCell className="text-muted-foreground max-w-56 truncate text-xs">{c.source.title}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  {c.tables.slice(0, 2).map((t) => <Code key={t}>{t}</Code>)}
                  {c.tables.length > 2 && <span className="text-muted-foreground text-xs">+{c.tables.length - 2}</span>}
                  {!c.tables.length && <span className="text-muted-foreground">–</span>}
                </div>
              </TableCell>
              <TableCell>{c.usesFunction ? <ToneBadge tone="warning">Function</ToneBadge> : <ToneBadge tone="success">None</ToneBadge>}</TableCell>
              <TableCell className="text-xs">{c.auth.length ? c.auth.join(', ') : <span className="text-muted-foreground">–</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

export function Connectors({ insights }: { insights: Insights }) {
  const list = insights.connectors
  if (!list.length) return <Card className="text-muted-foreground p-5 text-sm">This solution does not include a data connector.</Card>
  if (list.length <= 3) return <div className="space-y-4">{list.map((c, i) => <ConnectorCard key={`${c.name}-${i}`} c={c} index={i} />)}</div>
  return (
    <Accordion type="single" collapsible defaultValue="c-0" className="space-y-2">
      {list.map((c, i) => (
        <AccordionItem key={`${c.name}-${i}`} value={`c-${i}`} className={cn('bg-card rounded-xl border border-l-4 not-last:border-b')} style={{ borderLeftColor: c.methodInfo.color }}>
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <span className="flex flex-wrap items-center gap-2.5">
              <MethodBadge method={c.method.primary} />
              <b>{c.name}</b>
              <span className="text-muted-foreground text-xs font-normal">{c.tables.slice(0, 2).join(', ') || 'no tables declared'}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-2 pb-2">
            <ConnectorCard c={c} index={i} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
