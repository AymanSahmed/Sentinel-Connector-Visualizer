import type { ReactNode } from 'react'
import { TableIndexProvider } from '@/components/shared/table-chip'
import type { AnalysisResult } from '@/lib/types'
import { plural } from '@/lib/format'
import { toMarkdown } from '@/lib/markdown'
import { Answers } from './answers'
import { ConnectorOverview, Connectors, MethodsLegend } from './connectors'
import { Coverage } from './coverage'
import { Hero, Kpis } from './hero'
import { Findings, TablesMatrix } from './tables-findings'

function Heading({ id, title, hint }: { id: string; title: string; hint?: ReactNode }) {
  return (
    <h2 id={id} className="mt-2 flex scroll-mt-20 items-baseline gap-3 text-xl font-bold tracking-tight">
      <span className="bg-primary h-5 w-1.5 self-center rounded-full" />
      {title}
      {hint && <small className="text-muted-foreground text-sm font-normal">{hint}</small>}
    </h2>
  )
}

/** The plain-language "what is this solution" report. */
export function ReportView({ result }: { result: AnalysisResult }) {
  const { insights } = result
  return (
    <TableIndexProvider insights={insights}>
      <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
        <Hero insights={insights} onCopy={() => toMarkdown(insights)} />
        <Kpis insights={insights} />
        <Answers insights={insights} />

        <Heading id="sec-connectors" title="Data ingestion — how logs reach Sentinel" hint={plural(insights.connectors.length, 'connector')} />
        <MethodsLegend insights={insights} />
        <ConnectorOverview insights={insights} />
        <Connectors insights={insights} />

        <Heading id="sec-coverage" title="Detection & response content" hint="what you get after installing" />
        <Coverage insights={insights} />

        {insights.tables.length > 0 && (
          <>
            <Heading id="sec-tables" title="Data tables" hint="who writes them and who reads them" />
            <TablesMatrix insights={insights} />
          </>
        )}

        {insights.findings.length > 0 && (
          <>
            <Heading id="sec-findings" title="Good to know" />
            <Findings insights={insights} />
          </>
        )}
      </div>
    </TableIndexProvider>
  )
}
