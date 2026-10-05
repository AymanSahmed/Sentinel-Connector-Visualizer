import type { ReactNode } from 'react'
import { Boxes, Briefcase, Cable, Database, Radio, Shield } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { MethodBadge } from '@/components/shared/badges'
import { TableChips } from '@/components/shared/table-chip'
import type { ConnectorInsight, Insights } from '@/lib/types'
import { SEVERITY_ORDER, plural } from '@/lib/format'
import { cn } from '@/lib/utils'

function groupBy<T>(list: T[], fn: (x: T) => string) {
  const m = new Map<string, T[]>()
  list.forEach((x) => m.set(fn(x), [...(m.get(fn(x)) ?? []), x]))
  return [...m.entries()]
}
const unique = <T,>(a: T[]) => [...new Set(a)]
const names = (items: ConnectorInsight[], max = 3) => items.slice(0, max).map((x) => x.name).join(', ') + (items.length > max ? ` +${items.length - max} more` : '')

function Question({ color, icon: Icon, title, children, className }: { color: string; icon: typeof Radio; title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('gap-3 border-l-4 p-4', className)} style={{ borderLeftColor: color }}>
      <h3 className="flex items-center gap-2 text-[11px] font-extrabold tracking-widest uppercase" style={{ color }}>
        <Icon className="size-4" />
        {title}
      </h3>
      <div className="space-y-2 text-sm">{children}</div>
    </Card>
  )
}

/** Dedupes near-identical prerequisite sentences (token overlap) so each requirement shows once. */
function dedupeSimilar(list: string[]) {
  const tokens = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
  const kept: string[] = []
  list.forEach((item) => {
    const t = tokens(item)
    if (!t.size) return
    const similar = kept.some((k) => {
      const kt = tokens(k)
      let hit = 0
      t.forEach((w) => kt.has(w) && hit++)
      return hit / Math.max(1, Math.min(t.size, kt.size)) >= 0.6
    })
    if (!similar) kept.push(item)
  })
  return kept
}

export function Answers({ insights }: { insights: Insights }) {
  const c = insights.connectors
  const pbs = insights.content.playbooks
  const k = insights.counts

  const fn = insights.functionAnswer
  const fnColor = fn.state === 'yes' ? '#d97706' : fn.state === 'optional' ? '#2563eb' : '#059669'
  const fnApps = unique(c.flatMap((x) => x.functionApps))
  const tablesIn = unique(c.flatMap((x) => x.tables))

  const prereq: string[] = []
  c.forEach((x) => {
    x.prerequisites.customs.forEach((p) => prereq.push(`${p.name || ''}${p.name && p.text ? ': ' : ''}${p.text || ''}`.trim()))
    if (x.inputs.length) prereq.push(`${x.name}: you provide ${x.inputs.slice(0, 4).join(', ')}`)
  })
  if (c.some((x) => x.method.primary === 'ccf-push')) prereq.push('Rights to register a Microsoft Entra app and assign the Monitoring Metrics Publisher role')
  if (c.some((x) => x.usesFunction)) prereq.push('An Azure subscription to host the Function App (compute + storage cost)')
  if (c.some((x) => x.method.primary === 'agent')) prereq.push('A Linux log forwarder / host with Azure Monitor Agent')
  if (pbs.length) {
    const apis = unique(pbs.flatMap((p) => p.connectors)).slice(0, 5)
    prereq.push(`Each playbook deploys a Logic App${apis.length ? ` with API connections to ${apis.join(', ')}` : ''} — you authorise those connections after deployment`)
  }
  unique(c.flatMap((x) => x.prerequisites.permissions)).slice(0, 3).forEach((p) => prereq.push(p))
  const prerequisites = dedupeSimilar(unique(prereq.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)))

  const sev = insights.content.severity
  const gets: ReactNode[] = []
  if (k.analytics)
    gets.push(
      <li key="a">
        <b>{k.analytics}</b> analytics rules{' '}
        <span className="text-muted-foreground">({SEVERITY_ORDER.filter((s) => sev[s]).map((s) => `${sev[s]} ${s}`).join(' · ')})</span>
      </li>,
    )
  if (k.hunting) gets.push(<li key="h"><b>{k.hunting}</b> hunting queries</li>)
  if (k.workbooks) gets.push(<li key="w"><b>{k.workbooks}</b> {k.workbooks > 1 ? 'workbooks' : 'workbook'} for dashboards</li>)
  if (k.playbooks) gets.push(<li key="p"><b>{k.playbooks}</b> response {k.playbooks > 1 ? 'playbooks' : 'playbook'}</li>)
  if (k.parsers) gets.push(<li key="f"><b>{k.parsers}</b> KQL {k.parsers > 1 ? 'parsers / functions' : 'parser / function'}</li>)
  if (k.watchlists) gets.push(<li key="l"><b>{k.watchlists}</b> {k.watchlists > 1 ? 'watchlists' : 'watchlist'}</li>)

  const hosts = unique(pbs.flatMap((p) => p.endpoints)).slice(0, 6)
  const apiNames = unique(pbs.flatMap((p) => p.connectors)).slice(0, 6)

  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Question color="#0d9488" icon={Radio} title="Where do the logs come from?">
        {c.length ? (
          <ul className="space-y-2">
            {groupBy(c, (x) => x.source.title).map(([title, items]) => (
              <li key={title}>
                <b>{title}</b> {items.length > 1 && <span className="text-muted-foreground">×{items.length}</span>}
                <div className="text-muted-foreground text-xs">{names(items)}</div>
              </li>
            ))}
          </ul>
        ) : pbs.length && !insights.queriedOnly.length ? (
          <>
            <p>Nothing is ingested — the playbooks call external services:</p>
            {hosts.length || apiNames.length ? (
              <div className="flex flex-wrap gap-1.5">
                {[...hosts, ...apiNames].map((h) => (
                  <span key={h} className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs">{h}</span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">Endpoints are set when the Logic App is deployed.</p>
            )}
          </>
        ) : (
          <>
            <p>No connector shipped.{insights.queriedOnly.length > 0 && ' Queries existing tables:'}</p>
            <TableChips names={insights.queriedOnly.map((t) => t.name)} max={8} />
          </>
        )}
      </Question>

      <Question color="#7c3aed" icon={Cable} title="How are they collected?">
        {c.length ? (
          <ul className="space-y-3">
            {groupBy(c, (x) => x.method.primary).map(([key, items]) => (
              <li key={key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <MethodBadge method={key} />
                  {items.length > 1 && <b className="text-muted-foreground">×{items.length}</b>}
                </div>
                <p className="text-muted-foreground text-xs">
                  {items[0].methodInfo.hosting}
                  {items[0].method.functionIngestion && ` · writes via ${items[0].method.functionIngestion}`}
                </p>
                <p className="text-muted-foreground text-xs">{names(items)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Not applicable.</p>
        )}
      </Question>

      <Question color={fnColor} icon={Boxes} title="Is an Azure Function involved?">
        <p className="text-xl font-bold" style={{ color: fnColor }}>
          {fn.state === 'yes' ? 'Yes' : fn.state === 'optional' ? 'Optional' : 'No'}
        </p>
        <p>{fn.text}</p>
        {fnApps.length > 0 && <p className="text-muted-foreground text-xs">Deploys {plural(fnApps.length, 'Function App')} into your subscription.</p>}
        {insights.solution.technologies.length > 0 && (
          <p className="text-muted-foreground text-xs">Solution lists dependencies: {insights.solution.technologies.join(', ')}</p>
        )}
      </Question>

      <Question color="#0891b2" icon={Database} title="Where does the data land?">
        {tablesIn.length ? <TableChips names={tablesIn} max={8} /> : <p className="text-muted-foreground">No tables are created by this solution.</p>}
      </Question>

      <Question color="#d97706" icon={Briefcase} title="What do I need to deploy it?">
        {prerequisites.length ? (
          <ul className="list-disc space-y-1.5 pl-4">
            {prerequisites.slice(0, 6).map((p) => (
              <li key={p}>{p.length > 200 ? `${p.slice(0, 197)}…` : p}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Standard Sentinel workspace permissions.</p>
        )}
      </Question>

      <Question color="#db2777" icon={Shield} title="What do I get?">
        {gets.length ? <ul className="list-disc space-y-1 pl-4">{gets}</ul> : <p className="text-muted-foreground">No content files were detected.</p>}
      </Question>
    </div>
  )
}
