import { z } from "zod"

export const canvasPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  pressure: z.number().min(0).max(1).optional(),
})

export const canvasStrokeSchema = z.object({
  id: z.string().min(1),
  color: z.string().min(1),
  width: z.number().min(1).max(40),
  points: z.array(canvasPointSchema).min(2),
  createdAt: z.number().optional(),
})

export const canvasTextBlockSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(280),
  x: z.number().finite(),
  y: z.number().finite(),
  color: z.string().min(1),
  fontSize: z.number().min(8).max(96),
  align: z.enum(["left", "center", "right"]).default("left"),
})

export const canvasStateSchema = z.object({
  version: z.literal(1),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  background: z.string().optional(),
  strokes: z.array(canvasStrokeSchema),
  textBlocks: z.array(canvasTextBlockSchema).optional(),
  notes: z.string().max(2000).optional(),
})

export type CanvasPoint = z.infer<typeof canvasPointSchema>
export type CanvasStroke = z.infer<typeof canvasStrokeSchema>
export type CanvasTextBlock = z.infer<typeof canvasTextBlockSchema>
export type CanvasState = z.infer<typeof canvasStateSchema>

export function cloneCanvasState(state: CanvasState): CanvasState {
  return {
    ...state,
    strokes: state.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
    textBlocks: state.textBlocks?.map((block) => ({ ...block })) ?? [],
  }
}

export function canvasHasContent(state: CanvasState | null | undefined): boolean {
  if (!state) return false
  const strokes = state.strokes.length
  const textBlocks = state.textBlocks?.length ?? 0
  return strokes > 0 || textBlocks > 0
}
