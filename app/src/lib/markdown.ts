import type { Insights } from '@/lib/types'
import { plural } from '@/lib/format'

/** Plain-text summary for the "Copy summary" action. */
export function toMarkdown(ins: Insights): string {
  const s = ins.solution
  const L: string[] = [`# ${s.name}`, '', s.description || '']
  L.push('', `**Publisher:** ${s.publisher || 'n/a'}${s.version ? ` · **Version:** ${s.version}` : ''}${s.support?.tier ? ` · **Support:** ${s.support.tier}` : ''}`, '')
  L.push('## Data collection')
  if (!ins.connectors.length) L.push('No data connector.')
  ins.connectors.forEach((c) => {
    L.push(
      `### ${c.name} — ${c.methodInfo.label}`,
      `- Source: ${c.source.title}${c.source.lines[0] ? ` (${c.source.lines.map((l) => l.value).slice(0, 3).join(', ')})` : ''}`,
      `- Hosting: ${c.methodInfo.hosting}${c.method.functionIngestion ? ` · writes via ${c.method.functionIngestion}` : ''}`,
      `- Tables: ${c.tables.join(', ') || 'n/a'}`,
    )
    if (c.auth.length) L.push(`- Authentication: ${c.auth.join(', ')}`)
  })
  L.push('', `**Azure Function:** ${ins.functionAnswer.text}`, '', '## Content shipped')
  const k = ins.counts
  L.push(`- Analytics rules: ${k.analytics}`, `- Hunting queries: ${k.hunting}`, `- Workbooks: ${k.workbooks}`, `- Playbooks: ${k.playbooks}`, `- Parsers: ${k.parsers}`, `- Watchlists: ${k.watchlists}`)
  if (ins.findings.length) L.push('', '## Good to know', ...ins.findings.map((f) => `- ${f.text}`))
  L.push('', `_${plural(ins.connectors.length, 'connector')}, ${plural(k.tables ?? 0, 'ingested table')}._`)
  return L.join('\n')
}
