// @ts-nocheck
/*
 * Orchestrates one analysis run — the headless equivalent of the legacy handleVisualize().
 * Pure data in, plain result object out: no DOM access.
 */
import { STATE, configureEngine } from './shims.js'
import {
  listSolutions,
  detectDefaultBranch,
  listSolutionJsonPaths,
  fetchSolutionFiles,
  buildArtifacts,
  extractSolutionMeta,
  analyzeSolutionArchitecture,
  analyzeCreateUiDefinition,
  buildSolutionInsights,
  insReconcileArchitecture,
} from './engine.generated.js'

export { configureEngine, listSolutions, detectDefaultBranch }
export { INS_METHODS, INS_ARCH_CATEGORIES, INS_TACTICS } from './engine.generated.js'

export async function analyzeSolution({ owner, repo, branch, solution }) {
  STATE.inventory = null
  STATE.inventoryTruncated = false

  const paths = await listSolutionJsonPaths(owner, repo, branch, solution)
  if (!paths.length) throw new Error('No JSON/YAML files found for this solution')

  const files = await fetchSolutionFiles(owner, repo, branch, paths, true)
  if (!files.length) throw new Error('No files could be fetched')

  const artifacts = buildArtifacts(files)
  const meta = await extractSolutionMeta(owner, repo, branch, solution, paths)
  STATE.meta = meta
  STATE.artifacts = artifacts

  const analysis = analyzeSolutionArchitecture(artifacts, { mode: 'balanced', tieBreakPreference: 'ccf' })
  const wizardFile = files.find((f) => /createuidefinition\.json$/i.test(f.path))
  const createUi = wizardFile ? analyzeCreateUiDefinition(wizardFile.json) : null

  const insights = buildSolutionInsights(artifacts, meta)
  STATE.insights = insights
  insReconcileArchitecture(analysis, insights)

  return {
    solution,
    repo: `${owner}/${repo}`,
    branch,
    artifacts,
    meta,
    analysis,
    createUi,
    insights,
    inventory: STATE.inventory,
  }
}
