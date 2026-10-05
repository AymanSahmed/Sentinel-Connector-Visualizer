import type { AnalysisResult, MethodInfo, ArchCategory } from '@/lib/types'

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
