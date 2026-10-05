import { useState, type ReactNode } from 'react'
import { Building2, ClipboardCopy, LifeBuoy, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Insights } from '@/lib/types'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'

const unique = <T,>(a: T[]) => [...new Set(a)]

/** One auto-written sentence that tells a newcomer what the solution does and how it collects data. */
export function summarySentence(ins: Insights): ReactNode {
  const { solution: s, connectors: c, counts: k } = ins
  const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold underline decoration-white/40 underline-offset-4">{children}</strong>

  const ships: string[] = []
  if (k.analytics) ships.push(plural(k.analytics, 'analytics rule'))
  if (k.hunting) ships.push(plural(k.hunting, 'hunting query', 'hunting queries'))
  if (k.workbooks) ships.push(plural(k.workbooks, 'workbook'))
  if (k.playbooks) ships.push(plural(k.playbooks, 'playbook'))
  if (k.parsers) ships.push(plural(k.parsers, 'parser'))
  const ships_ = ships.length ? (
    <>
      It ships <B>{ships.join(', ')}</B>.
    </>
  ) : (
    'No detection or response content was found in the repository files.'
  )

  if (!c.length) {
    const pbs = ins.content.playbooks
    if (pbs.length && !k.analytics && !k.hunting && !k.workbooks) {
      const hosts = unique(pbs.flatMap((p) => p.endpoints)).slice(0, 3)
      const apis = unique(pbs.flatMap((p) => p.connectors)).slice(0, 4)
      const writing = pbs.filter((p) => p.writesToWorkspace).length
      return (
        <>
          <B>{s.name}</B> is an <B>automation-only</B> solution: {plural(k.playbooks, 'Logic App playbook')} that enrich or respond to incidents
          {hosts.length > 0 && <>, calling {hosts.join(', ')}</>}
          {apis.length > 0 && <> through {apis.join(', ')}</>}.{' '}
          {writing
            ? `${writing === pbs.length ? 'All of them' : `${writing} of them`} write their results back to Log Analytics (Logs Ingestion API / Data Collector API), but there is no connector or Azure Function to set up.`
            : 'It ingests no data, so there is no connector or Azure Function to set up.'}
        </>
      )
    }
    const queried = ins.queriedOnly.slice(0, 4).map((t) => t.name)
    return (
      <>
        <B>{s.name}</B> is a <B>content-only</B> solution — it has no data connector and analyses data already in your workspace
        {queried.length > 0 && <> ({queried.join(', ')}{ins.queriedOnly.length > 4 ? ', …' : ''})</>}. {ships_}
      </>
    )
  }

  const groups = new Map<string, string[]>()
  c.forEach((x) => groups.set(x.methodInfo.label, [...(groups.get(x.methodInfo.label) ?? []), x.name]))
  const how = [...groups.entries()].map(([label, names], i) => (
    <span key={label}>
      {i > 0 && ' and '}
      <B>{label}</B> ({names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')})
    </span>
  ))
  const tables = unique(c.flatMap((x) => x.tables)).slice(0, 4)
  const fn = ins.functionAnswer.state
  return (
    <>
      <B>{s.name}</B> collects data using {how}
      {tables.length > 0 && <>, storing it in {tables.map((t, i) => <span key={t}>{i > 0 && ', '}<B>{t}</B></span>)}</>}.{' '}
      {fn === 'yes' ? <>It <B>requires an Azure Function</B>.</> : fn === 'optional' ? <>An <B>Azure Function is optional</B> (legacy path).</> : <><B>No Azure Function</B> is needed.</>} {ships_}
    </>
  )
}

export function Hero({ insights, onCopy }: { insights: Insights; onCopy: () => string }) {
  const s = insights.solution
  const [logoFailed, setLogoFailed] = useState(false)
  const tags: { icon?: ReactNode; text: string }[] = [
    s.publisher && { icon: <Building2 className="size-3" />, text: s.publisher },
    s.version && { text: `v${s.version}` },
    s.support?.tier && { icon: <LifeBuoy className="size-3" />, text: `${s.support.tier} support` },
    s.is1P && { text: 'Microsoft first-party' },
    ...s.domains.slice(0, 3).map((d) => ({ icon: <Tag className="size-3" />, text: d })),
  ].filter(Boolean) as { icon?: ReactNode; text: string }[]

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-600 to-teal-600 p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start gap-5">
        {s.logo && !logoFailed ? (
          <img src={s.logo} alt="" onError={() => setLogoFailed(true)} className="size-[72px] rounded-2xl bg-white object-contain p-2 shadow-md" />
        ) : (
          <div className="grid size-[72px] place-items-center rounded-2xl bg-white/20 text-3xl font-extrabold">{s.name.charAt(0)}</div>
        )}
        <div className="min-w-72 flex-1 space-y-3">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">{s.name}</h2>
            <p className="mt-1 max-w-4xl text-sm text-white/85">{s.description || 'Microsoft Sentinel solution'}</p>
          </div>
          <p className="max-w-4xl rounded-xl border border-white/25 bg-white/12 px-4 py-3 text-[15px] leading-relaxed backdrop-blur-sm">{summarySentence(insights)}</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t.text} className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-xs">
                {t.icon}
                {t.text}
              </span>
            ))}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 bg-white/20 text-white hover:bg-white/30"
          onClick={() => {
            void navigator.clipboard?.writeText(onCopy())
            toast.success('Summary copied as Markdown')
          }}
        >
          <ClipboardCopy /> Copy summary
        </Button>
      </div>
    </section>
  )
}

const KPI: [string, string, string, string][] = [
  ['connectors', 'Connectors', '#0d9488', 'sec-connectors'],
  ['tables', 'Tables ingested', '#0891b2', 'sec-tables'],
  ['analytics', 'Analytics rules', '#7c3aed', 'sec-coverage'],
  ['hunting', 'Hunting queries', '#6366f1', 'sec-coverage'],
  ['workbooks', 'Workbooks', '#2563eb', 'sec-coverage'],
  ['playbooks', 'Playbooks', '#db2777', 'sec-coverage'],
  ['parsers', 'Parsers', '#14b8a6', 'sec-coverage'],
  ['watchlists', 'Watchlists', '#d97706', 'sec-coverage'],
]

export function Kpis({ insights }: { insights: Insights }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {KPI.map(([key, label, color, target]) => {
        const n = insights.counts[key] ?? 0
        return (
          <button
            key={key}
            type="button"
            onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={cn('bg-card hover:border-foreground/20 rounded-xl border border-t-4 p-3 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md', n === 0 && 'opacity-70')}
            style={{ borderTopColor: color }}
          >
            <span className="block text-3xl leading-none font-extrabold tabular-nums" style={{ color }}>
              {n}
            </span>
            <span className="text-muted-foreground mt-1.5 block text-[11px] font-semibold tracking-wider uppercase">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
