import * as React from "react"
import type { RigComponentWire } from "@/lib/tauri"

/**
 * The show's rig components, provided by the patch editor so deeply
 * nested canvas pieces (node footers, inspectors) can resolve a source
 * node's `rigComponentId` without threading props through the canvas
 * tree. Defaults to empty — Storybook stories that don't care render
 * every source as unassigned, which is the honest default.
 */
export const RigComponentsContext = React.createContext<RigComponentWire[]>([])

export function useRigComponents(): RigComponentWire[] {
  return React.useContext(RigComponentsContext)
}
