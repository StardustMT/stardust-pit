import { SIGNAL_DEFAULT_COLORS, type SignalKind } from "./_types"

/** Axis-aligned obstacle the wire should route around. */
export interface ObstacleRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PatchWireProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  signal: SignalKind
  /** Per-wire color override; falls back to signal default. */
  color?: string
  /** True while signal flows through it — pulse / glow effect. */
  active?: boolean
  selected?: boolean
  /**
   * Node bounding rects the wire should avoid. The source/target nodes
   * for this wire should NOT be in this list — they're the endpoints.
   * Used to pick an "above" or "below" deflection when the direct route
   * would cross a third-party node.
   */
  obstacles?: ObstacleRect[]
  onSelect?: () => void
  onOpenMenu?: (anchor: { x: number; y: number }) => void
}

/**
 * Bézier-curved cable between two ports with collision-avoiding routing.
 *
 * Step 1: try a simple Bézier with horizontal output / horizontal input
 * tangents. Sample at 24 points. If any sample lands inside an obstacle
 * (with padding), step 2 kicks in.
 *
 * Step 2: pick a Y above or below the offending cluster (whichever is
 * closer to the average of from.y and to.y) and re-issue the Bézier with
 * intermediate control points at that Y. The result is a wire that swoops
 * up or down to clear blocking nodes without losing the curve's flow.
 *
 * This is intentionally not a full orthogonal router — those produce
 * dense angular paths in tight layouts. A bent Bézier reads as one
 * smooth cable even in routed-around cases.
 */
export function PatchWire({
  from,
  to,
  signal,
  color,
  active,
  selected,
  obstacles,
  onSelect,
  onOpenMenu,
}: PatchWireProps) {
  const stroke = color ?? SIGNAL_DEFAULT_COLORS[signal]
  const path = routedBezier(from, to, obstacles ?? [])
  return (
    <g
      onClick={onSelect}
      onContextMenu={(e) => {
        if (!onOpenMenu) return
        e.preventDefault()
        onOpenMenu({ x: e.clientX, y: e.clientY })
      }}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      {/* Wide invisible hit target so the cable is clickable without pixel-perfect aim */}
      {(onSelect || onOpenMenu) && (
        <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
      )}
      {active && (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={8}
          strokeLinecap="round"
          opacity={0.45}
          style={{ filter: "blur(3px)" }}
        />
      )}
      {selected && (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.5}
        />
      )}
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </g>
  )
}

// =============================================================================
// Routing
// =============================================================================

const OBSTACLE_PADDING = 14
const SAMPLE_COUNT = 32

function routedBezier(
  from: { x: number; y: number },
  to: { x: number; y: number },
  obstacles: ObstacleRect[],
): string {
  // Step 1: try the straightforward path.
  const simpleControls = computeControls(from, to, from.y, to.y, false)
  const simplePath = bezierString(from, to, simpleControls.c1, simpleControls.c2)

  if (obstacles.length === 0) return simplePath

  // Step 2: check for collisions on the straight path.
  const samples = sampleBezier(from, to, simpleControls.c1, simpleControls.c2, SAMPLE_COUNT)
  const colliding = obstacles.filter((obs) =>
    samples.some((s) => pointInRect(s, expand(obs, OBSTACLE_PADDING))),
  )

  if (colliding.length === 0) return simplePath

  // Step 3: try routing above and below the colliding cluster, pick the
  // path that's collision-free (preferring the side closer to the line
  // between source and target). Both attempts use OVERSHOOT — placing the
  // control points further than clearY so the curve's midpoint actually
  // lands at clearY (a Bézier with c1.y = c2.y = clearY interpolates back
  // toward source/target Y values in the middle, falling short).
  const minY = Math.min(...colliding.map((o) => o.y - OBSTACLE_PADDING))
  const maxY = Math.max(...colliding.map((o) => o.y + o.height + OBSTACLE_PADDING))

  const aboveCandidate = routedAround(from, to, minY, "above", obstacles)
  const belowCandidate = routedAround(from, to, maxY, "below", obstacles)

  const avgY = (from.y + to.y) / 2
  const distAbove = Math.abs(avgY - minY)
  const distBelow = Math.abs(avgY - maxY)

  // Prefer the closer-clearance side IF it actually clears. Fall back to
  // the other. If neither clears, take the shorter overshoot anyway —
  // tighter is usually less ugly than wildly bent.
  const prefAbove = distAbove < distBelow
  if (prefAbove && aboveCandidate.clear) return aboveCandidate.path
  if (!prefAbove && belowCandidate.clear) return belowCandidate.path
  if (aboveCandidate.clear) return aboveCandidate.path
  if (belowCandidate.clear) return belowCandidate.path
  return prefAbove ? aboveCandidate.path : belowCandidate.path
}

/**
 * Generate a bent Bézier whose midpoint sits at `clearY` (above or below
 * the obstacles), with control-point overshoot to compensate for the
 * Bézier interpolation pulling the curve back toward source/target Y.
 */
function routedAround(
  from: { x: number; y: number },
  to: { x: number; y: number },
  clearY: number,
  side: "above" | "below",
  obstacles: ObstacleRect[],
): { path: string; clear: boolean } {
  // Solve for c1.y = c2.y such that the curve's midpoint Y lands at clearY.
  //   midpoint Y = 0.125*from.y + 0.375*c1.y + 0.375*c2.y + 0.125*to.y
  //   if c1.y = c2.y = cY:
  //     midpoint Y = 0.125*(from.y + to.y) + 0.75*cY
  //   cY = (clearY - 0.125*(from.y + to.y)) / 0.75
  let cY = (clearY - 0.125 * (from.y + to.y)) / 0.75
  // Add extra overshoot in the chosen direction so the curve clears even
  // wider — the obstacle-side margin is more important than a tight curve.
  const extra = 20
  cY = side === "above" ? cY - extra : cY + extra

  const bent = computeControls(from, to, cY, cY, true)
  const path = bezierString(from, to, bent.c1, bent.c2)

  const samples = sampleBezier(from, to, bent.c1, bent.c2, SAMPLE_COUNT)
  const clear = !obstacles.some((obs) =>
    samples.some((s) => pointInRect(s, expand(obs, OBSTACLE_PADDING))),
  )
  return { path, clear }
}

function computeControls(
  from: { x: number; y: number },
  to: { x: number; y: number },
  c1y: number,
  c2y: number,
  bending: boolean,
): { c1: { x: number; y: number }; c2: { x: number; y: number } } {
  const dx = to.x - from.x
  const tangent = Math.max(48, Math.abs(dx) * (bending ? 0.45 : 0.6))
  return {
    c1: { x: from.x + tangent, y: c1y },
    c2: { x: to.x - tangent, y: c2y },
  }
}

function bezierString(
  from: { x: number; y: number },
  to: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
): string {
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`
}

function sampleBezier(
  p0: { x: number; y: number },
  p3: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  count: number,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = new Array(count)
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt
    const t2 = t * t
    const t3 = t2 * t
    out[i] = {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    }
  }
  return out
}

function pointInRect(p: { x: number; y: number }, r: ObstacleRect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}

function expand(r: ObstacleRect, pad: number): ObstacleRect {
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + 2 * pad,
    height: r.height + 2 * pad,
  }
}
