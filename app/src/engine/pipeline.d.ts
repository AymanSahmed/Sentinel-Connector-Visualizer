import type { AnalysisResult, MethodInfo, ArchCategory, Insights, VolumeRow } from '@/lib/types'

export interface EngineHooks {
  log?: (message: string, isError: boolean) => void
  status?: (message: string, isError: boolean) => void
  progress?: (done: number, total: number) => void
  rateLimit?: (info: { remaining: number; limit: number; reset: number | null }) => void
  token?: string
}

export function configureEngine(hooks: EngineHooks): void
export function listSolutions(owner: string, repo: string, branch: string): Promise<string[]>
export function detectDefaultBranch(owner: string, repo: string): Promise<string | null>
export function analyzeSolution(input: { owner: string; repo: string; branch: string; solution: string }): Promise<AnalysisResult>

export const INS_METHODS: Record<string, MethodInfo>
export const INS_ARCH_CATEGORIES: Record<string, ArchCategory>
export const INS_TACTICS: string[]
export const INS_PB_KINDS: Record<string, string>
export const INS_VOLUME_UNITS: Record<string, string>
export const INS_VOLUME_SPREAD: { low: number; high: number }

export interface VolumeEstimateRow extends VolumeRow {
  events: number
  eps: number
  gbPerDay: number
}
export interface VolumeFigures {
  eps: number
  gbPerDay: number
  gbPerMonth: number
}
export function insVolumeRows(insights: Insights): VolumeRow[]
export function insEstimateVolume(
  rows: VolumeRow[],
  units: Record<string, number>,
): {
  rows: VolumeEstimateRow[]
  total: VolumeFigures & { events: number }
  range: Record<'low' | 'likely' | 'high', VolumeFigures>
}
export function insVolumeKql(tables: string[]): string
