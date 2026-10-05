import { useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DetailCard } from '@/components/shared/detail-card'
import { SeverityPill, ToneBadge } from '@/components/shared/badges'
import { TableChips } from '@/components/shared/table-chip'
import { INS_TACTICS } from '@/engine/pipeline.js'
import type { Insights, PlaybookInsight, RuleInsight } from '@/lib/types'
import { SEVERITY_BAR, SEVERITY_ORDER, TRIGGER_COLOR, prettyTactic } from '@/lib/format'

function Section({ title, count, color, children }: { title: ReactNode; count: number; color: string; children: ReactNode }) {
  return (
    <Card className="gap-3 p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        {title}
        <span className="ml-auto text-2xl font-extrabold tabular-nums" style={{ color }}>
          {count}
        </span>
      </h3>
      {children}
    </Card>
  )
}

/** Scrollable list that shows the first few rows and expands in place. */
function ExpandableList<T>({ items, max = 8, render }: { items: T[]; max?: number; render: (item: T, i: number) => ReactNode }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, max)
  return (
    <div className="space-y-2">
      <ul className="max-h-[26rem] space-y-1.5 overflow-auto pr-1">{shown.map(render)}</ul>
      {items.length > max && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </Button>
      )}
    </div>
  )
}

const Row = ({ children }: { children: ReactNode }) => <li className="bg-muted/30 flex flex-col gap-1 rounded-lg border px-3 py-2">{children}</li>

function RuleRow({ a }: { a: RuleInsight }) {
  const meta = [a.tactics.map(prettyTactic).join(', '), a.frequency && `runs every ${a.frequency.replace(/^PT?/i, '').toLowerCase()}`, a.kind].filter(Boolean).join(' · ')
  return (
    <DetailCard
      asChild
      side="left"
      title={a.name}
      subtitle={`${a.severity} severity${a.kind ? ` · ${a.kind}` : ''}`}
      accent={SEVERITY_BAR[a.severity] ?? SEVERITY_BAR.Unknown}
      sections={[
        { label: 'Tactics', value: a.tactics.map(prettyTactic).join(', ') },
        { label: 'Techniques', value: a.techniques.join(', ') },
        { label: 'Frequency', value: a.frequency && `every ${a.frequency.replace(/^PT?/i, '').toLowerCase()}` },
        { label: 'Lookback', value: a.period && a.period.replace(/^PT?/i, '').toLowerCase() },
        { label: 'Tables', value: a.tables.join(', ') },
        { label: 'About', value: a.description && (a.description.length > 220 ? `${a.description.slice(0, 217)}…` : a.description) },
      ]}
      trigger={
        <li className="bg-muted/30 hover:bg-muted/60 flex cursor-default flex-col gap-1 rounded-lg border px-3 py-2">
          <div className="flex items-center gap-2">
            <SeverityPill severity={a.severity} />
            <span className="text-sm font-medium">{a.name}</span>
          </div>
          {meta && <span className="text-muted-foreground text-xs">{meta}</span>}
          {a.tables.length > 0 && <TableChips names={a.tables} max={4} />}
        </li>
      }
    />
  )
}

function AnalyticsCard({ insights }: { insights: Insights }) {
  const C = insights.content
  const total = Math.max(1, C.analytics.length)
  const maxT = Math.max(1, ...Object.values(C.tacticCounts))
  const sorted = [...C.analytics].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
  return (
    <Section title="🔍 Analytics rules" count={insights.counts.analytics} color="#7c3aed">
      <div className="bg-muted flex h-3.5 overflow-hidden rounded-full">
        {SEVERITY_ORDER.filter((s) => C.severity[s]).map((s) => (
          <i key={s} className="block h-full" style={{ width: `${(C.severity[s] / total) * 100}%`, backgroundColor: SEVERITY_BAR[s] }} title={`${s}: ${C.severity[s]}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        {SEVERITY_ORDER.filter((s) => C.severity[s]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <i className="size-2.5 rounded-sm" style={{ backgroundColor: SEVERITY_BAR[s] }} />
            {s} {C.severity[s]}
          </span>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">MITRE ATT&amp;CK tactics covered (analytics + hunting)</p>
      <div className="grid grid-cols-7 gap-1">
        {INS_TACTICS.map((t) => {
          const n = C.tacticCounts[t] ?? 0
          const strength = n / maxT
          return (
            <div
              key={t}
              title={`${prettyTactic(t)}: ${n}`}
              className="rounded-md border px-1 py-1 text-center text-[10px] leading-tight"
              style={n ? { backgroundColor: `color-mix(in srgb, #7c3aed ${Math.round(15 + 75 * strength)}%, transparent)`, color: strength > 0.5 ? '#fff' : undefined } : { opacity: 0.5 }}
            >
              <b className="block text-sm">{n || '·'}</b>
              {prettyTactic(t)}
            </div>
          )
        })}
      </div>
      <ExpandableList items={sorted} render={(a, i) => <RuleRow key={`${a.name}-${i}`} a={a} />} />
    </Section>
  )
}

function PlaybookRow({ p }: { p: PlaybookInsight }) {
  return (
    <DetailCard
      asChild
      side="left"
      title={p.name}
      subtitle={`${p.trigger} trigger`}
      accent={TRIGGER_COLOR[p.trigger] ?? '#475569'}
      sections={[
        { label: 'Trigger', value: p.trigger },
        { label: 'Connections', value: p.connectors.join(', ') },
        { label: 'Calls', value: p.endpoints.join(', ') },
        { label: 'Actions', value: String(p.actions) },
        { label: 'Writes to', value: p.writesToWorkspace ? 'Log Analytics (Logs Ingestion / Data Collector API)' : undefined },
        { label: 'About', value: p.description },
      ]}
      trigger={
        <li className="bg-muted/30 hover:bg-muted/60 flex cursor-default flex-col gap-1.5 rounded-lg border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{p.name}</span>
            <Badge variant="outline" className="rounded-full border-0 ring-1 ring-inset" style={{ color: TRIGGER_COLOR[p.trigger] ?? '#475569', backgroundColor: `${TRIGGER_COLOR[p.trigger] ?? '#475569'}18` }}>
              {p.trigger}
            </Badge>
            {p.writesToWorkspace && <ToneBadge tone="info">writes to Log Analytics</ToneBadge>}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {p.connectors.map((x) => (
              <Badge key={x} variant="secondary" className="text-[11px]">🔗 {x}</Badge>
            ))}
            <span className="text-muted-foreground text-xs">{p.actions} actions</span>
          </div>
        </li>
      }
    />
  )
}

export function Coverage({ insights }: { insights: Insights }) {
  const C = insights.content
  const k = insights.counts
  const cards: ReactNode[] = []

  if (C.analytics.length) cards.push(<AnalyticsCard key="a" insights={insights} />)
  if (C.hunting.length)
    cards.push(
      <Section key="h" title="🎯 Hunting queries" count={k.hunting} color="#6366f1">
        <ExpandableList items={C.hunting} render={(h, i) => (
          <Row key={`${h.name}-${i}`}>
            <span className="text-sm font-medium">{h.name}</span>
            {h.tactics.length > 0 && <span className="text-muted-foreground text-xs">{h.tactics.map(prettyTactic).join(', ')}</span>}
          </Row>
        )} />
      </Section>,
    )
  if (C.workbooks.length)
    cards.push(
      <Section key="w" title="📊 Workbooks" count={k.workbooks} color="#2563eb">
        <ExpandableList items={C.workbooks} render={(w, i) => (
          <Row key={`${w.name}-${i}`}>
            <span className="text-sm font-medium">{w.name}</span>
            {w.description && <span className="text-muted-foreground text-xs">{w.description.slice(0, 160)}</span>}
            {w.tables.length > 0 && <TableChips names={w.tables} max={5} />}
          </Row>
        )} />
      </Section>,
    )
  if (C.playbooks.length)
    cards.push(
      <Section key="p" title="⚡ Playbooks" count={k.playbooks} color="#db2777">
        <ExpandableList items={C.playbooks} render={(p, i) => <PlaybookRow key={`${p.name}-${i}`} p={p} />} />
      </Section>,
    )
  if (C.parsers.length)
    cards.push(
      <Section key="f" title="ƒ Parsers & functions" count={k.parsers} color="#14b8a6">
        <ExpandableList max={6} items={C.parsers} render={(f, i) => (
          <Row key={`${f.name}-${i}`}>
            <span className="text-sm font-medium">{f.name}</span>
            {f.alias && f.alias !== f.name && <span className="text-muted-foreground text-xs">alias {f.alias}</span>}
            {f.tables.length > 0 && <TableChips names={f.tables} max={4} />}
          </Row>
        )} />
      </Section>,
    )
  if (C.watchlists.length || C.notebooks.length || C.automationRules.length)
    cards.push(
      <Section key="o" title="🧩 Other content" count={C.watchlists.length + C.notebooks.length + C.automationRules.length} color="#d97706">
        {C.watchlists.length > 0 && <div className="space-y-1"><p className="text-muted-foreground text-xs">Watchlists</p><div className="flex flex-wrap gap-1.5">{C.watchlists.map((w) => <Badge key={w.name} variant="secondary">{w.name}</Badge>)}</div></div>}
        {C.notebooks.length > 0 && <div className="space-y-1"><p className="text-muted-foreground text-xs">Notebooks</p><div className="flex flex-wrap gap-1.5">{C.notebooks.map((w) => <Badge key={w.name} variant="secondary">{w.name}</Badge>)}</div></div>}
        {C.automationRules.length > 0 && <div className="space-y-1"><p className="text-muted-foreground text-xs">Automation rules</p><div className="flex flex-wrap gap-1.5">{C.automationRules.map((w) => <Badge key={w.id} variant="secondary">{w.id}</Badge>)}</div></div>}
      </Section>,
    )

  if (!cards.length)
    return <Card className="text-muted-foreground p-5 text-sm">No analytics rules, hunting queries, workbooks, playbooks or parsers were found in this solution’s repository files.</Card>
  return <div className="grid items-start gap-4 xl:grid-cols-2">{cards}</div>
}
