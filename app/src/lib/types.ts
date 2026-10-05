/* Shapes produced by the analysis engine (src/engine). Loose on purpose: the engine is generated JS. */

export interface MethodInfo {
  label: string
  sub: string
  color: string
  hosting: string
  icon: string
  how: string
}

export interface ArchCategory {
  label: string
  cls: string
}

export interface Evidence {
  file?: string
  where?: string
  snippet?: string
}

export interface MethodSignal {
  key: string
  strength: 'strong' | 'medium'
  why: string
  evidence?: Evidence[]
}

export interface ConnectorInsight {
  name: string
  publisher: string
  description: string
  files: string[]
  method: { primary: string; keys: string[]; found: MethodSignal[]; functionIngestion: string | null }
  methodInfo: MethodInfo
  source: { title: string; lines: { label: string; value: string; meta?: string }[]; note: string }
  auth: string[]
  inputs: string[]
  prerequisites: { permissions: string[]; customs: { name: string; text: string }[] }
  schedule: { windowMin: number | null; paging: string[]; qps: unknown[] }
  pollers: { label: string; url: string; method: string; windowMin: number | null; stream: string; table: string }[]
  tables: string[]
  tablesInferred?: boolean
  dcrs: { id: string; flows: number; transform: boolean; outputTables: string[]; inputStreams: string[] }[]
  hasTransform: boolean
  hasDce: boolean
  functionApps: string[]
  usesFunction: boolean
  isPreview: boolean
  legacy: boolean
  endpointsReferenced: string[]
  consumers: { analytics: number; hunting: number; workbooks: number; parsers: number }
  archCategory?: string
}

export interface RuleInsight {
  name: string
  severity: string
  tactics: string[]
  techniques: string[]
  tables: string[]
  frequency: string
  period: string
  kind: string
  description: string
}

export interface PlaybookInsight {
  name: string
  trigger: string
  connectors: string[]
  endpoints: string[]
  actions: number
  description: string
  writesToWorkspace: boolean
}

export interface TableInsight {
  name: string
  producers: string[]
  analytics: string[]
  hunting: string[]
  workbooks: string[]
  parsers: string[]
  schema: { columns: number; plan?: string; retention?: number } | null
  custom: boolean
}

export interface Finding {
  level: 'info' | 'warn' | 'good'
  text: string
}

export interface Insights {
  solution: {
    name: string
    publisher: string
    version: string
    description: string
    logo: string
    support: { tier?: string; name?: string; link?: string } | null
    categories: string[]
    domains: string[]
    verticals: string[]
    technologies: string[]
    is1P: boolean
  }
  connectors: ConnectorInsight[]
  functionAnswer: { state: 'yes' | 'no' | 'optional'; text: string }
  content: {
    analytics: RuleInsight[]
    hunting: { name: string; tactics: string[]; tables: string[]; description: string }[]
    workbooks: { name: string; tables: string[]; description: string }[]
    parsers: { name: string; alias: string; tables: string[]; description: string }[]
    playbooks: PlaybookInsight[]
    watchlists: { name: string }[]
    notebooks: { name: string; cells: number }[]
    automationRules: { id: string }[]
    severity: Record<string, number>
    tacticCounts: Record<string, number>
  }
  tables: TableInsight[]
  queriedOnly: TableInsight[]
  findings: Finding[]
  counts: Record<string, number>
}

export interface ArchitectureAnalysis {
  type: string
  label: string
  confidence: number
  lowConfidence: boolean
  primaryClass: string | null
  architectureSet: string[]
  categoryCounts: Record<string, number>
  connectors: { id: string; ccfScore: number; httpScore: number; category?: string; httpMatched?: string[] }[]
  core: Record<string, boolean | Record<string, boolean>>
  reasoningLines: string[]
  findings: { side: string; pattern: string; file: string; line: number; lineText: string }[]
  legacySignals: string[]
  counts: Record<string, number>
}

export interface AnalysisResult {
  solution: string
  repo: string
  branch: string
  artifacts: any
  meta: { solutionName: string; publisher: string; categories: string[]; domains: string[]; [k: string]: unknown }
  analysis: ArchitectureAnalysis
  createUi: { solutionName: string; description: string; steps: number; stepNames: string[] } | null
  insights: Insights
  inventory: { expected: number; fetched: number; failed: number; truncated: boolean } | null
}
