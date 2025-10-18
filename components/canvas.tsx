"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { canvasStateSchema } from "@/lib/canvas"
import type { CanvasState, CanvasStroke } from "@/lib/canvas"
import { cn } from "@/lib/utils"

import { Button } from "./ui/button"

interface CanvasProps {
  initialData?: CanvasState | null
  onChange?: (data: CanvasState) => void
  onSave?: (data: CanvasState) => void
  readOnly?: boolean
  className?: string
}

type Tool = "pen" | "eraser"

const DEFAULT_SIZE = { width: 1600, height: 900 }
const DEFAULT_STROKE_COLOR = "#111827"
const DEFAULT_STROKE_WIDTH = 6

const COLOR_SWATCHES = ["#111827", "#1d4ed8", "#ea580c", "#ca8a04", "#16a34a", "#db2777", "#6b21a8"]
const STROKE_WIDTHS = [3, 6, 10, 16]

function createEmptyState(): CanvasState {
  return {
    version: 1,
    size: DEFAULT_SIZE,
    background: "#ffffff",
    strokes: [],
    textBlocks: [],
  }
}

function cloneStroke(stroke: CanvasStroke): CanvasStroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }
}

function cloneState(state: CanvasState): CanvasState {
  return {
    ...state,
    strokes: state.strokes.map(cloneStroke),
    textBlocks: state.textBlocks?.map((block) => ({ ...block })) ?? [],
  }
}

function statesEqual(a: CanvasState, b: CanvasState): boolean {
  if (a.version !== b.version) return false
  if (a.size.width !== b.size.width || a.size.height !== b.size.height) return false
  if ((a.background ?? "") !== (b.background ?? "")) return false

  if (a.strokes.length !== b.strokes.length) return false
  for (let index = 0; index < a.strokes.length; index += 1) {
    const strokeA = a.strokes[index]
    const strokeB = b.strokes[index]

    if (!strokeA || !strokeB) {
      return false
    }

    if (strokeA.color !== strokeB.color || strokeA.width !== strokeB.width) {
      return false
    }

    if (strokeA.points.length !== strokeB.points.length) {
      return false
    }

    for (let pointIndex = 0; pointIndex < strokeA.points.length; pointIndex += 1) {
      const pointA = strokeA.points[pointIndex]
      const pointB = strokeB.points[pointIndex]
      if (!pointA || !pointB) {
        return false
      }
      if (pointA.x !== pointB.x || pointA.y !== pointB.y) {
        return false
      }
    }
  }

  const textBlocksA = a.textBlocks ?? []
  const textBlocksB = b.textBlocks ?? []
  if (textBlocksA.length !== textBlocksB.length) return false
  for (let index = 0; index < textBlocksA.length; index += 1) {
    const blockA = textBlocksA[index]
    const blockB = textBlocksB[index]
    if (!blockA || !blockB) return false
    if (
      blockA.id !== blockB.id ||
      blockA.text !== blockB.text ||
      blockA.x !== blockB.x ||
      blockA.y !== blockB.y ||
      blockA.color !== blockB.color ||
      blockA.fontSize !== blockB.fontSize ||
      blockA.align !== blockB.align
    ) {
      return false
    }
  }

  return true
}

function parseInitialState(initialData?: CanvasState | null): CanvasState {
  if (!initialData) {
    return createEmptyState()
  }

  const parsed = canvasStateSchema.safeParse(initialData)
  if (!parsed.success) {
    return createEmptyState()
  }

  const result = parsed.data
  if (result.textBlocks === undefined) {
    result.textBlocks = []
  }

  return result
}

function generateStrokeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `stroke_${Math.random().toString(36).slice(2, 11)}`
}

function getCanvasCoordinates(event: PointerEvent, canvas: HTMLCanvasElement, size = DEFAULT_SIZE) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = size.width / rect.width
  const scaleY = size.height / rect.height

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

export function Canvas({ initialData, onChange, onSave, readOnly = false, className }: CanvasProps) {
  const [tool, setTool] = useState<Tool>("pen")
  const [color, setColor] = useState(DEFAULT_STROKE_COLOR)
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH)
  const [canvasState, setCanvasState] = useState<CanvasState>(() => parseInitialState(initialData))

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<CanvasStroke | null>(null)
  const activePointerRef = useRef<number | null>(null)

  const strokeCount = canvasState.strokes.length
  const textBlockCount = canvasState.textBlocks ? canvasState.textBlocks.length : 0

  const hasContent = useMemo(() => strokeCount > 0 || textBlockCount > 0, [strokeCount, textBlockCount])

  const applyState = useCallback(
    (next: CanvasState) => {
      const snapshot = cloneState(next)
      setCanvasState(snapshot)
      onChange?.(snapshot)
    },
    [onChange],
  )

  useEffect(() => {
    const parsed = parseInitialState(initialData)
    if (!statesEqual(parsed, canvasState) && !isDrawingRef.current) {
      setCanvasState(parsed)
    }
    // Only react when caller provides new data — ignore onChange dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData])

  const drawScene = useCallback(
    (previewStroke?: CanvasStroke | null) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext("2d")
      if (!context) return

      const { width, height } = canvasState.size
      context.clearRect(0, 0, width, height)

      const background = canvasState.background ?? "#ffffff"
      context.fillStyle = background
      context.fillRect(0, 0, width, height)

      const renderStroke = (stroke: CanvasStroke) => {
        if (!stroke.points.length) return
        context.lineJoin = "round"
        context.lineCap = "round"
        context.strokeStyle = stroke.color
        context.lineWidth = stroke.width

        context.beginPath()
        const [first, ...rest] = stroke.points
        context.moveTo(first.x, first.y)
        for (const point of rest) {
          context.lineTo(point.x, point.y)
        }
        context.stroke()
      }

      for (const stroke of canvasState.strokes) {
        renderStroke(stroke)
      }

      if (previewStroke) {
        renderStroke(previewStroke)
      }
    },
    [canvasState],
  )

  useEffect(() => {
    drawScene()
  }, [canvasState, drawScene])

  const commitStroke = useCallback(
    (stroke: CanvasStroke) => {
      applyState({
        ...canvasState,
        strokes: [...canvasState.strokes, cloneStroke(stroke)],
      })
    },
    [applyState, canvasState],
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (readOnly) return

      const canvas = canvasRef.current
      if (!canvas) return

      canvas.setPointerCapture(event.pointerId)
      activePointerRef.current = event.pointerId

      const nextStroke: CanvasStroke = {
        id: generateStrokeId(),
        color: tool === "eraser" ? "#ffffff" : color,
        width: strokeWidth,
        points: [],
      }

      const coordinates = getCanvasCoordinates(event, canvas, canvasState.size)
      nextStroke.points.push(coordinates)

      isDrawingRef.current = true
      currentStrokeRef.current = nextStroke
      drawScene(nextStroke)
    },
    [canvasState.size, color, drawScene, readOnly, strokeWidth, tool],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isDrawingRef.current) return
      if (activePointerRef.current !== null && activePointerRef.current !== event.pointerId) {
        return
      }

      const canvas = canvasRef.current
      const stroke = currentStrokeRef.current
      if (!canvas || !stroke) return

      const coordinates = getCanvasCoordinates(event, canvas, canvasState.size)
      stroke.points.push(coordinates)
      drawScene(stroke)
    },
    [canvasState.size, drawScene],
  )

  const endStroke = useCallback(
    (event: PointerEvent) => {
      if (!isDrawingRef.current) return
      if (activePointerRef.current !== null && activePointerRef.current !== event.pointerId) {
        return
      }

      const canvas = canvasRef.current
      const stroke = currentStrokeRef.current
      if (!canvas || !stroke) return

      isDrawingRef.current = false
      currentStrokeRef.current = null
      activePointerRef.current = null
      canvas.releasePointerCapture(event.pointerId)

      if (stroke.points.length > 1) {
        commitStroke(stroke)
      } else {
        drawScene()
      }
    },
    [commitStroke, drawScene],
  )

  const handleUndo = useCallback(() => {
    if (!canvasState.strokes.length) return
    const nextState = {
      ...canvasState,
      strokes: canvasState.strokes.slice(0, -1),
    }
    applyState(nextState)
  }, [applyState, canvasState])

  const handleClear = useCallback(() => {
    applyState({
      ...canvasState,
      strokes: [],
    })
  }, [applyState, canvasState])

  const handleSave = useCallback(() => {
    const snapshot = cloneState(canvasState)
    onSave?.(snapshot)
  }, [canvasState, onSave])

  useEffect(() => {
    const canvasElement = canvasRef.current
    if (!canvasElement || readOnly) return

    const handlePointerDownBound = (event: PointerEvent) => handlePointerDown(event)
    const handlePointerMoveBound = (event: PointerEvent) => handlePointerMove(event)
    const handlePointerUpBound = (event: PointerEvent) => endStroke(event)

    canvasElement.addEventListener("pointerdown", handlePointerDownBound)
    canvasElement.addEventListener("pointermove", handlePointerMoveBound)
    canvasElement.addEventListener("pointerup", handlePointerUpBound)
    canvasElement.addEventListener("pointerleave", handlePointerUpBound)
    canvasElement.addEventListener("pointercancel", handlePointerUpBound)

    return () => {
      canvasElement.removeEventListener("pointerdown", handlePointerDownBound)
      canvasElement.removeEventListener("pointermove", handlePointerMoveBound)
      canvasElement.removeEventListener("pointerup", handlePointerUpBound)
      canvasElement.removeEventListener("pointerleave", handlePointerUpBound)
      canvasElement.removeEventListener("pointercancel", handlePointerUpBound)
    }
  }, [endStroke, handlePointerDown, handlePointerMove, readOnly])

  return (
    <div className={cn("retro-border flex flex-col bg-background", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-foreground bg-muted p-4">
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={tool === "pen" ? "default" : "outline"}
                  onClick={() => setTool("pen")}
                >
                  Pen
                </Button>
                <Button
                  size="sm"
                  variant={tool === "eraser" ? "default" : "outline"}
                  onClick={() => setTool("eraser")}
                >
                  Eraser
                </Button>
              </div>

              <div className="flex items-center gap-1">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => {
                      setTool("pen")
                      setColor(swatch)
                    }}
                    className={cn(
                      "size-6 rounded-full border border-border transition",
                      color === swatch ? "ring-2 ring-offset-2 ring-offset-background" : "",
                    )}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Use ${swatch} ink`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1">
                {STROKE_WIDTHS.map((width) => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => setStrokeWidth(width)}
                    className={cn(
                      "flex h-6 items-center rounded border border-border px-2 text-xs font-semibold uppercase",
                      strokeWidth === width ? "bg-foreground text-background" : "bg-background",
                    )}
                    aria-label={`Brush width ${width}px`}
                  >
                    {width}px
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleUndo} disabled={!hasContent}>
              Undo
            </Button>
            <Button size="sm" variant="secondary" onClick={handleClear} disabled={!hasContent}>
              Clear
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasContent}>
              Save Snapshot
            </Button>
          </div>
        )}
      </div>

      <div className="relative aspect-video w-full bg-white">
        <canvas
          ref={canvasRef}
          width={canvasState.size.width}
          height={canvasState.size.height}
          className={cn("h-full w-full touch-none", readOnly && "pointer-events-none")}
        />
        {!readOnly && !hasContent && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
              Start sketching your idea
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
