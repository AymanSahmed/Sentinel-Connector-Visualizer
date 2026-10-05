// Headless smoke test: runs the extracted engine in Node against the live Azure-Sentinel repo.
import { analyzeSolution } from '../src/engine/pipeline.js'

const names = process.argv.slice(2)
const targets = names.length ? names : ['1Password', 'VirusTotal', 'Okta Single Sign-On', 'CyberArkAudit']

for (const solution of targets) {
  const t0 = Date.now()
  try {
    const r = await analyzeSolution({ owner: 'Azure', repo: 'Azure-Sentinel', branch: 'master', solution })
    const c = r.insights.counts
    const counts = Object.entries(c).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(' ')
    const cats = Object.values(r.analysis.categoryCounts || {}).reduce((s, v) => s + v, 0)
    console.log(`${solution.padEnd(22)} ${((Date.now() - t0) / 1000).toFixed(1)}s | ${counts} | ${r.analysis.label} ${Math.round(r.analysis.confidence * 100)}% | catSum=${cats}/${r.insights.connectors.length} | inv=${r.inventory?.fetched}/${r.inventory?.expected}`)
  } catch (e) {
    console.log(`${solution.padEnd(22)} FAILED: ${e.stack || e}`)
  }
}
