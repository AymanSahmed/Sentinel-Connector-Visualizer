import { INS_METHODS } from '@/engine/pipeline.js'
import type { Insights } from '@/lib/types'
import { plural, prettyTactic } from '@/lib/format'

export const STAGES = [
  { id: 'sources', label: 'Data sources', n: 1, color: '#0d9488' },
  { id: 'collection', label: 'Collection method', n: 2, color: '#7c3aed' },
  { id: 'ingestion', label: 'Ingestion & transform', n: 3, color: '#2563eb' },
  { id: 'storage', label: 'Log Analytics tables', n: 4, color: '#0891b2' },
  { id: 'consume', label: 'Detection & response', n: 5, color: '#db2777' },
] as const

export type StageId = (typeof STAGES)[number]['id']
export type FlowKind = 'data' | 'write' | 'query' | 'alert' | 'auto'

export const FLOW_COLOR: Record<FlowKind, string> = { data: '#0d9488', write: '#0891b2', query: '#6e7ec1', alert: '#8b5cf6', auto: '#ec4899' }
export const FLOW_LEGEND: { kind: FlowKind; label: string; dashed?: boolean }[] = [
  { kind: 'data', label: 'data collection flow' },
  { kind: 'write', label: 'written to table' },
  { kind: 'query', label: 'queried by content' },
  { kind: 'alert', label: 'alert → incident' },
  { kind: 'auto', label: 'response automation', dashed: true },
]

export interface FlowCard {
  id: string
  title: string
  sub: string
  accent: string
  tooltip: string
}

export interface FlowContainer {
  id: string
  label: string
  accent: string
  cards: FlowCard[]
  limit: number
}

export interface FlowEdge {
  from: string
  to: string
  label: string
  kind: FlowKind
  dashed?: boolean
}

export interface FlowModel {
  stages: { id: StageId; label: string; n: number; color: string; containers: FlowContainer[] }[]
  edges: FlowEdge[]
}

const SEV_COLOR: Record<string, string> = { High: '#dc2626', Medium: '#d97706', Low: '#2563eb', Informational: '#64748b', Unknown: '#94a3b8' }
const uniq = <T,>(a: T[]) => [...new Set(a)]

function groupBy<T>(list: T[], fn: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>()
  list.forEach((x) => {
    const k = fn(x)
    m.set(k, [...(m.get(k) ?? []), x])
  })
  return [...m.entries()]
}

/** Builds the Sources → Collection → Ingestion → Tables → Detection model from the insights report. */
export function buildFlowModel(ins: Insights): FlowModel {
  const stages: FlowModel['stages'] = STAGES.map((s) => ({ ...s, containers: [] }))
  const stage = (id: StageId) => stages.find((s) => s.id === id)!
  const edges: FlowEdge[] = []
  const seen = new Set<string>()
  const link = (from: string, to: string, label: string, kind: FlowKind, dashed = false) => {
    const key = `${from}|${to}|${label}`
    if (!from || !to || seen.has(key)) return
    seen.add(key)
    edges.push({ from, to, label, kind, dashed })
  }
  const card = (id: string, title: string, sub: string, accent: string, tooltip: string): FlowCard => ({ id, title, sub, accent, tooltip })
  const add = (st: StageId, id: string, label: string, accent: string, cards: FlowCard[], limit = 4) => stage(st).containers.push({ id, label, accent, cards, limit })

  const C = ins.connectors
  const { analytics: A, hunting: H, workbooks: W, parsers: F, playbooks: P } = ins.content

  /* 1 · sources */
  if (C.length) {
    add('sources', 'src', 'Source systems', '#0d9488', groupBy(C, (c) => c.source.title).map(([title, items]) =>
      card(`src:${title}`, title, plural(items.length, 'connector'), '#0d9488', `Source: ${title}\n${items.slice(0, 8).map((c) => `• ${c.name}`).join('\n')}`)), 5)
  } else if (ins.queriedOnly.length) {
    add('sources', 'src', 'Existing workspace data', '#0d9488', [card('src:existing', 'Data already in your workspace', `${plural(ins.queriedOnly.length, 'table')} queried`, '#0d9488', 'This solution ships no connector; it analyses tables ingested by other solutions or Azure services.')], 1)
  }

  /* 2 · collection */
  groupBy(C, (c) => c.method.primary).forEach(([key, items]) => {
    const m = INS_METHODS[key]
    add('collection', `col:${key}`, `${m.icon} ${m.label}`, m.color, items.map((c) =>
      card(`conn:${c.name}`, c.name, c.tables.length ? c.tables.slice(0, 2).join(', ') : m.sub, m.color,
        `${c.name}\nMethod: ${m.label}\nHosting: ${m.hosting}${c.tables.length ? `\nTables: ${c.tables.join(', ')}` : ''}${c.auth.length ? `\nAuth: ${c.auth.join(', ')}` : ''}`)))
    items.forEach((c) => link(`src:${c.source.title}`, `col:${key}`, 'collected via', 'data'))
  })

  /* 3 · ingestion */
  const dcrCards = new Map<string, FlowCard>()
  C.forEach((c) => c.dcrs.forEach((d) => {
    if (!dcrCards.has(d.id)) dcrCards.set(d.id, card(`dcr:${d.id}`, d.id, `${plural(d.flows, 'flow')}${d.transform ? ' · transform' : ''}`, '#2563eb', `Data Collection Rule\nFlows: ${d.flows}\nTransform: ${d.transform ? 'yes' : 'no'}\nOutputs: ${d.outputTables.join(', ') || 'n/a'}`))
  }))
  const fnCards = C.filter((c) => c.usesFunction).map((c) => card(`fn:${c.name}`, 'Function App', `runs ${c.name}`, '#d97706', `Azure Function App deployed in the customer subscription\nWrites via: ${c.method.functionIngestion || 'Log Analytics ingestion'}`))
  const count = (pred: (c: (typeof C)[number]) => boolean) => C.filter(pred).length
  const agentN = count((c) => c.method.primary === 'agent')
  const nativeN = count((c) => c.method.primary === 'native')
  const httpN = count((c) => c.method.keys.includes('http-collector'))
  const cloudN = count((c) => c.method.primary === 'ccf-cloud')

  if (dcrCards.size || C.some((c) => c.hasDce && c.method.primary !== 'agent'))
    add('ingestion', 'ing:dcr', 'Data Collection Rules', '#2563eb', dcrCards.size ? [...dcrCards.values()] : [card('dcr:auto', 'Data Collection Rule', 'created when connector is deployed', '#2563eb', 'Codeless connectors create the DCE and DCR automatically.')], 3)
  if (fnCards.length) add('ingestion', 'ing:fn', 'Azure Function Apps', '#d97706', fnCards, 3)
  if (agentN) add('ingestion', 'ing:agent', 'Agents / log forwarders', '#475569', [card('agent:ama', 'Azure Monitor Agent', `CEF · Syslog · Windows (${agentN})`, '#475569', 'Agent or Linux log forwarder collects events and forwards them to the workspace.')], 1)
  if (nativeN) add('ingestion', 'ing:native', 'Built-in connection', '#0369a1', [card('native:builtin', 'Native Sentinel connection', plural(nativeN, 'connector'), '#0369a1', 'Connected inside Sentinel — no DCR, agent or Function to manage.')], 1)
  if (httpN) add('ingestion', 'ing:http', 'Data Collector API (legacy)', '#b45309', [card('http:legacy', 'HTTP Data Collector API', plural(httpN, 'connector'), '#b45309', 'Workspace shared-key ingestion — superseded by the Logs Ingestion API.')], 1)
  if (cloudN) add('ingestion', 'ing:cloud', 'Cloud storage / queue', '#0891b2', [card('cloud:store', 'Customer cloud storage', plural(cloudN, 'connector'), '#0891b2', 'The source writes logs to a bucket/queue/container that Sentinel reads.')], 1)

  const ingFor = (c: (typeof C)[number]) => {
    const p = c.method.primary
    const out: string[] = []
    if (['ccf-pull', 'ccf-push', 'logs-ingestion'].includes(p) || (c.dcrs.length && p !== 'agent')) out.push('ing:dcr')
    if (c.usesFunction) out.push('ing:fn')
    if (p === 'agent') out.push('ing:agent')
    if (p === 'native') out.push('ing:native')
    if (c.method.keys.includes('http-collector')) out.push('ing:http')
    if (p === 'ccf-cloud') out.push('ing:cloud')
    return uniq(out).filter((id) => stage('ingestion').containers.some((x) => x.id === id))
  }
  const ingLabel: Record<string, string> = { 'ing:dcr': 'via DCR', 'ing:fn': 'runs in', 'ing:agent': 'forwarded by', 'ing:native': 'built-in', 'ing:http': 'posts to', 'ing:cloud': 'reads from' }
  C.forEach((c) => ingFor(c).forEach((id) => link(`col:${c.method.primary}`, id, ingLabel[id], 'data')))

  /* 4 · tables */
  const produced = ins.tables.filter((t) => t.producers.length)
  const custom = produced.filter((t) => t.custom)
  const builtin = produced.filter((t) => !t.custom)
  const queried = ins.queriedOnly
  const tcard = (t: (typeof produced)[number]) =>
    card(`tbl:${t.name}`, t.name, `${t.custom ? 'custom' : 'built-in'}${t.schema ? ` · ${t.schema.columns} columns` : ''}`, t.custom ? '#0891b2' : '#64748b',
      `${t.name}\n${t.custom ? 'Custom table' : 'Built-in table'}\nIngested by: ${t.producers.join(', ')}\nUsed by: ${t.analytics.length} analytics · ${t.hunting.length} hunting · ${t.workbooks.length} workbooks`)
  if (custom.length) add('storage', 'store:custom', 'Custom tables (_CL)', '#0891b2', custom.map(tcard), 5)
  if (builtin.length) add('storage', 'store:builtin', 'Built-in tables', '#64748b', builtin.map(tcard), 5)
  if (queried.length) add('storage', 'store:queried', 'Also queried (other sources)', '#94a3b8', queried.map((t) => card(`tbl:${t.name}`, t.name, 'not ingested here', '#94a3b8', `${t.name}\nQueried by this solution's content but ingested by another connector or Azure service.`)), 4)

  const storeOf = (name: string): string | null => {
    const t = ins.tables.find((x) => x.name.toLowerCase() === name.toLowerCase())
    if (!t) return null
    return t.producers.length ? (t.custom ? 'store:custom' : 'store:builtin') : 'store:queried'
  }
  C.forEach((c) => {
    const targets = uniq(c.tables.map(storeOf).filter((x): x is string => !!x))
    const sources = ingFor(c).length ? ingFor(c) : [`col:${c.method.primary}`]
    sources.forEach((from) => targets.forEach((to) => {
      const n = c.tables.filter((t) => storeOf(t) === to).length
      link(from, to, plural(n, 'table'), 'write')
    }))
  })

  /* 5 · detection & response */
  const tacticList = (items: { tactics: string[] }[]) => uniq(items.flatMap((a) => a.tactics)).slice(0, 2).map(prettyTactic).join(', ')
  if (A.length) {
    const sev = ['High', 'Medium', 'Low', 'Informational', 'Unknown']
      .map((s) => ({ s, items: A.filter((a) => a.severity.toLowerCase() === s.toLowerCase()) }))
      .filter((x) => x.items.length)
      .map((x) => card(`ar:${x.s}`, `${x.items.length} ${x.s}`, tacticList(x.items) || 'severity', SEV_COLOR[x.s], `${x.s} severity analytics rules:\n${x.items.slice(0, 14).map((a) => `• ${a.name}`).join('\n')}${x.items.length > 14 ? '\n…' : ''}`))
    add('consume', 'use:analytics', `🔍 Analytics rules (${A.length})`, '#7c3aed', sev, 5)
    add('consume', 'use:incident', '🎛 Incident management', '#8b5cf6', [card('incident', 'Alerts → Incidents', 'Sentinel groups alerts', '#8b5cf6', 'Scheduled / NRT rules raise alerts that Sentinel aggregates into incidents.')], 1)
  }
  if (H.length) add('consume', 'use:hunting', `🎯 Hunting queries (${H.length})`, '#6366f1', [card('hunting:all', `${H.length} hunting queries`, tacticList(H) || 'proactive search', '#6366f1', H.slice(0, 14).map((h) => `• ${h.name}`).join('\n'))], 1)
  if (W.length) add('consume', 'use:workbooks', `📊 Workbooks (${W.length})`, '#2563eb', W.map((w) => card(`wb:${w.name}`, w.name, `${plural(w.tables.length, 'table')} visualised`, '#2563eb', `Workbook: ${w.name}\nTables: ${w.tables.join(', ') || 'n/a'}`)), 3)
  if (F.length) add('consume', 'use:parsers', `ƒ Parsers & functions (${F.length})`, '#14b8a6', F.map((f) => card(`fn:${f.name}`, f.name, f.alias && f.alias !== f.name ? `alias ${f.alias}` : 'KQL function', '#14b8a6', `${f.name}\nTables: ${f.tables.join(', ') || 'n/a'}`)), 3)
  if (P.length) add('consume', 'use:playbooks', `⚡ Playbooks (${P.length})`, '#ec4899', P.map((p) => card(`pb:${p.name}`, p.name, `${p.trigger} trigger`, '#ec4899', `Playbook: ${p.name}\nTrigger: ${p.trigger}\nConnectors: ${p.connectors.join(', ') || 'n/a'}`)), 3)

  const tablesOf = (id: string) => (id === 'store:custom' ? custom : id === 'store:builtin' ? builtin : queried).map((t) => t.name.toLowerCase())
  ;['store:custom', 'store:builtin', 'store:queried'].forEach((sc) => {
    if (!stage('storage').containers.some((x) => x.id === sc)) return
    const names = new Set(tablesOf(sc))
    const hit = (list: { tables: string[] }[]) => list.filter((x) => x.tables.some((t) => names.has(t.toLowerCase()))).length
    const a = hit(A), h = hit(H), w = hit(W), f = hit(F)
    if (a) link(sc, 'use:analytics', plural(a, 'rule'), 'query')
    if (h) link(sc, 'use:hunting', plural(h, 'query', 'queries'), 'query')
    if (w) link(sc, 'use:workbooks', plural(w, 'workbook'), 'query')
    if (f) link(sc, 'use:parsers', plural(f, 'parser'), 'query')
  })
  if (A.length) link('use:analytics', 'use:incident', 'alert → incident', 'alert')
  if (A.length && P.length) link('use:incident', 'use:playbooks', 'can trigger', 'auto', true)

  return { stages: stages.filter((s) => s.containers.length), edges }
}
