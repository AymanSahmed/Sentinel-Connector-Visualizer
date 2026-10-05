// @ts-nocheck
/*
 * Runtime services the extracted engine expects (logging, status, auth headers, YAML).
 * The legacy page implemented these against the DOM; here they are small pluggable hooks.
 */
import * as yaml from 'js-yaml'

export const STATE = {
  cache: new Map(),
  meta: null,
  inventory: null,
  inventoryTruncated: false,
  insights: null,
  artifacts: null,
  blueprintExpanded: new Set(),
  includeNonCore: true,
  showEdgeLabels: false,
  dark: false,
}

const hooks = {
  log: () => {},
  status: () => {},
  progress: () => {},
  rateLimit: () => {},
  token: '',
}

export function configureEngine(next) {
  Object.assign(hooks, next)
}

export function log(msg, err = false) {
  hooks.log(String(msg), !!err)
}
export function setStatus(msg, err = false) {
  hooks.status(String(msg), !!err)
  log(msg, err)
}
export function onProgress(done, total) {
  hooks.progress(done, total)
}

export function escapeHtml(str) {
  if (str == null) return ''
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function ghHeaders() {
  const h = { Accept: 'application/vnd.github+json' }
  if (hooks.token) h.Authorization = `token ${hooks.token}`
  return h
}

export function updateRateLimit(res) {
  if (!res?.headers) return
  const remaining = res.headers.get('x-ratelimit-remaining')
  const limit = res.headers.get('x-ratelimit-limit')
  const reset = res.headers.get('x-ratelimit-reset')
  if (remaining && limit) hooks.rateLimit({ remaining: +remaining, limit: +limit, reset: reset ? +reset * 1000 : null })
}

export function updateInventoryIndicator() {
  /* the UI reads STATE.inventory directly */
}

export async function ensureYaml() {
  return yaml
}
