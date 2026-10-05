import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DetailCard } from '@/components/shared/detail-card'
import type { Insights } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FLOW_COLOR, FLOW_LEGEND, buildFlowModel, type FlowCard, type FlowContainer } from './flow-model'

interface Box { x: number; y: number; w: number; h: number }

function CardView({ card }: { card: FlowCard }) {
  const [title, ...rest] = card.tooltip.split('\n')
  return (
    <DetailCard
      side="top"
      title={title}
      accent={card.accent}
      sections={[{ label: 'Details', value: rest.length ? <span className="whitespace-pre-line">{rest.join('\n')}</span> : undefined }]}
      trigger={
        <div className="bg-card hover:bg-accent flex cursor-default items-stretch overflow-hidden rounded-lg border text-left shadow-xs transition-colors">
          <span className="w-1 shrink-0" style={{ backgroundColor: card.accent }} />
          <div className="min-w-0 px-2.5 py-1.5">
            <p className="truncate text-[13px] leading-tight font-semibold" title={card.title}>{card.title}</p>
            <p className="text-muted-foreground truncate text-[11px]">{card.sub}</p>
          </div>
        </div>
      }
    />
  )
}

function Container({ c, open, onToggle, register, dim, onHover }: {
  c: FlowContainer
  open: boolean
  onToggle: () => void
  register: (id: string, el: HTMLElement | null) => void
  dim: boolean
  onHover: (id: string | null) => void
}) {
  const cards = open ? c.cards : c.cards.slice(0, c.limit)
  const hidden = c.cards.length - c.limit
  return (
    <section
      ref={(el) => register(c.id, el)}
      onMouseEnter={() => onHover(c.id)}
      onMouseLeave={() => onHover(null)}
      className={cn('bg-card/70 space-y-1.5 rounded-xl border p-2 transition-opacity', dim && 'opacity-40')}
      style={{ borderTopColor: c.accent, borderTopWidth: 3 }}
    >
      <h4 className="px-1 text-xs font-semibold">
        {c.label}
        {!/\(\d+\)$/.test(c.label) && <span className="text-muted-foreground ml-1 font-normal">({c.cards.length})</span>}
      </h4>
      {cards.map((k) => <CardView key={k.id} card={k} />)}
      {hidden > 0 && (
        <Button variant="ghost" size="xs" className="w-full" onClick={onToggle}>
          {open ? 'Show less' : `+${hidden} more…`}
        </Button>
      )}
    </section>
  )
}

/** Left-to-right stage map. Edges are container-to-container and drawn from measured DOM boxes. */
export function FlowMap({ insights }: { insights: Insights }) {
  const model = useMemo(() => buildFlowModel(insights), [insights])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<string | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const els = useRef(new Map<string, HTMLElement>())
  const [boxes, setBoxes] = useState<Map<string, Box>>(new Map())
  const [size, setSize] = useState({ w: 0, h: 0 })

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) els.current.set(id, el)
    else els.current.delete(id)
  }, [])

  const measure = useCallback(() => {
    const root = wrap.current
    if (!root) return
    const r = root.getBoundingClientRect()
    const next = new Map<string, Box>()
    els.current.forEach((el, id) => {
      const b = el.getBoundingClientRect()
      next.set(id, { x: b.left - r.left, y: b.top - r.top, w: b.width, h: b.height })
    })
    setBoxes(next)
    setSize({ w: root.scrollWidth, h: root.scrollHeight })
  }, [])

  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [measure, model, expanded])

  const connected = useMemo(() => {
    if (!hover) return null
    const s = new Set([hover])
    model.edges.forEach((e) => {
      if (e.from === hover) s.add(e.to)
      if (e.to === hover) s.add(e.from)
    })
    return s
  }, [hover, model.edges])

  const toggle = (id: string) => setExpanded((p) => {
    const n = new Set(p)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  return (
    <div className="space-y-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        {FLOW_LEGEND.map((l) => (
          <span key={l.kind} className="inline-flex items-center gap-1.5">
            <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke={FLOW_COLOR[l.kind]} strokeWidth="2.5" strokeDasharray={l.dashed ? '4 3' : undefined} /></svg>
            {l.label}
          </span>
        ))}
        <span className="text-muted-foreground ml-auto">Hover a group to trace its flow · hover a card for details</span>
      </div>
      <Card className="overflow-x-auto p-4">
        <div ref={wrap} className="relative min-w-[1180px]">
          <svg className="pointer-events-none absolute inset-0 z-10" width={size.w} height={size.h}>
            <defs>
              {(Object.keys(FLOW_COLOR) as (keyof typeof FLOW_COLOR)[]).map((k) => (
                <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill={FLOW_COLOR[k]} />
                </marker>
              ))}
            </defs>
            {model.edges.map((e, i) => {
              const a = boxes.get(e.from), b = boxes.get(e.to)
              if (!a || !b) return null
              const sameCol = Math.abs(a.x - b.x) < 8
              const x1 = sameCol ? a.x + a.w : a.x + a.w, y1 = a.y + a.h / 2
              const x2 = sameCol ? b.x + b.w : b.x, y2 = b.y + b.h / 2
              const bend = sameCol ? 34 : Math.max(30, (x2 - x1) / 2)
              const d = sameCol
                ? `M${x1},${y1} C${x1 + bend},${y1} ${x2 + bend},${y2} ${x2},${y2}`
                : `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
              const lit = !hover || e.from === hover || e.to === hover
              const mx = sameCol ? x1 + bend * 0.75 : (x1 + x2) / 2
              const my = (y1 + y2) / 2
              return (
                <g key={i} opacity={lit ? 1 : 0.12} className="transition-opacity">
                  <path d={d} fill="none" stroke={FLOW_COLOR[e.kind]} strokeWidth={lit && hover ? 2.6 : 1.8} strokeDasharray={e.dashed ? '6 4' : undefined} markerEnd={`url(#arrow-${e.kind})`} />
                  <text x={mx} y={my - 4} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={FLOW_COLOR[e.kind]} stroke="var(--card)" strokeWidth="4" paintOrder="stroke">{e.label}</text>
                </g>
              )
            })}
          </svg>
          <div className="grid items-start gap-x-16" style={{ gridTemplateColumns: `repeat(${model.stages.length}, minmax(0, 1fr))` }}>
            {model.stages.map((s) => (
              <div key={s.id} className="space-y-3">
                <header className="flex items-center gap-2 border-b-2 pb-1.5" style={{ borderColor: s.color }}>
                  <span className="grid size-5 place-items-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: s.color }}>{s.n}</span>
                  <h3 className="text-sm font-semibold">{s.label}</h3>
                </header>
                {s.containers.map((c) => (
                  <Container
                    key={c.id}
                    c={c}
                    open={expanded.has(c.id)}
                    onToggle={() => toggle(c.id)}
                    register={register}
                    dim={!!connected && !connected.has(c.id)}
                    onHover={setHover}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
