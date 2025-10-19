"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"

import { canvasStateSchema } from "@/lib/canvas"
import type { CanvasState, CanvasStroke, CanvasTextBlock, CanvasImage } from "@/lib/canvas"
import { cn } from "@/lib/utils"

import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"

interface CanvasProps {
  initialData?: CanvasState | null
  onChange?: (data: CanvasState) => void
  onSave?: (data: CanvasState) => void
  readOnly?: boolean
  className?: string
}

type Tool = "pen" | "eraser" | "text" | "image"

const DEFAULT_SIZE = { width: 1600, height: 900 }
const DEFAULT_STROKE_COLOR = "#111827"
const DEFAULT_STROKE_WIDTH = 6
const DEFAULT_TEXT_COLOR = "#111827"
const DEFAULT_TEXT_FONT: CanvasTextBlock["fontFamily"] = "Inter"
const DEFAULT_TEXT_SIZE = 40

const COLOR_SWATCHES = ["#111827", "#1d4ed8", "#ea580c", "#ca8a04", "#16a34a", "#db2777", "#6b21a8"]
const STROKE_WIDTHS = [3, 6, 10, 16]
const TEXT_FONT_OPTIONS: Array<{ label: string; value: CanvasTextBlock["fontFamily"] }> = [
  { label: "Sans", value: "Inter" },
  { label: "Serif", value: "Georgia" },
  { label: "Mono", value: "Space Mono" },
  { label: "Display", value: "Bangers" },
]

function createEmptyState(): CanvasState {
  return {
    version: 1,
    size: DEFAULT_SIZE,
    background: "#ffffff",
    strokes: [],
    textBlocks: [],
    images: [],
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
    images: state.images?.map((image) => ({ ...image })) ?? [],
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
      blockA.align !== blockB.align ||
      blockA.fontFamily !== blockB.fontFamily
    ) {
      return false
    }
  }

  const imagesA = a.images ?? []
  const imagesB = b.images ?? []
  if (imagesA.length !== imagesB.length) return false
  for (let index = 0; index < imagesA.length; index += 1) {
    const imageA = imagesA[index]
    const imageB = imagesB[index]
    if (!imageA || !imageB) return false
    if (
      imageA.id !== imageB.id ||
      imageA.src !== imageB.src ||
      imageA.x !== imageB.x ||
      imageA.y !== imageB.y ||
      imageA.width !== imageB.width ||
      imageA.height !== imageB.height ||
      (imageA.rotation ?? 0) !== (imageB.rotation ?? 0)
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

function generateImageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `image_${Math.random().toString(36).slice(2, 11)}`
}

function generateTextId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `text_${Math.random().toString(36).slice(2, 11)}`
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

const LINE_HEIGHT_MULTIPLIER = 1.2
const HIGHLIGHT_PADDING = 6

function configureTextContext(context: CanvasRenderingContext2D, block: CanvasTextBlock) {
  context.font = `${block.fontSize}px ${block.fontFamily}, sans-serif`
  context.textAlign = block.align as CanvasTextAlign
  context.textBaseline = "alphabetic"
}

function getTextBounds(context: CanvasRenderingContext2D, block: CanvasTextBlock) {
  configureTextContext(context, block)
  const lines = block.text.split(/\n/g)
  const lineHeight = block.fontSize * LINE_HEIGHT_MULTIPLIER
  let maxWidth = 0

  for (const line of lines) {
    const metrics = context.measureText(line || " ")
    maxWidth = Math.max(maxWidth, metrics.width)
  }

  const totalHeight = Math.max(block.fontSize, lineHeight * lines.length)
  let anchorX = block.x
  if (block.align === "center") {
    anchorX -= maxWidth / 2
  } else if (block.align === "right") {
    anchorX -= maxWidth
  }

  const top = block.y - block.fontSize
  const bottom = block.y + lineHeight * (lines.length - 1)
  const height = Math.max(totalHeight, bottom - top + block.fontSize * 0.2)

  return {
    x: anchorX,
    y: top,
    width: Math.max(maxWidth, block.fontSize),
    height,
  }
}

function pointInBounds(point: { x: number; y: number }, bounds: { x: number; y: number; width: number; height: number }) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

export function Canvas({ initialData, onChange, onSave, readOnly = false, className }: CanvasProps) {
  const [tool, setTool] = useState<Tool>("pen")
  const [color, setColor] = useState(DEFAULT_STROKE_COLOR)
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH)
  const [canvasState, setCanvasState] = useState<CanvasState>(() => parseInitialState(initialData))
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR)
  const [textFontFamily, setTextFontFamily] = useState<CanvasTextBlock["fontFamily"]>(DEFAULT_TEXT_FONT)
  const [textFontSize, setTextFontSize] = useState(DEFAULT_TEXT_SIZE)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [imagePrompt, setImagePrompt] = useState("")
  const [pendingImagePosition, setPendingImagePosition] = useState<{ x: number; y: number } | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<CanvasStroke | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const isDraggingTextRef = useRef(false)
  const textDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const canvasSizeRef = useRef(DEFAULT_SIZE)
  const isDraggingImageRef = useRef(false)
  const imageDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({})

  const strokeCount = canvasState.strokes.length
  const textBlocks = useMemo(() => canvasState.textBlocks ?? [], [canvasState.textBlocks])
  const images = useMemo(() => canvasState.images ?? [], [canvasState.images])
  const textBlockCount = textBlocks.length
  const imageCount = images.length

  const hasContent = useMemo(() => strokeCount > 0 || textBlockCount > 0 || imageCount > 0, [
    strokeCount,
    textBlockCount,
    imageCount,
  ])

  useEffect(() => {
    canvasSizeRef.current = canvasState.size
  }, [canvasState.size])

  const selectedTextBlock = useMemo(
    () => textBlocks.find((block) => block.id === selectedTextId) ?? null,
    [selectedTextId, textBlocks],
  )

  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedImageId) ?? null,
    [images, selectedImageId],
  )

  const activeColor = selectedTextBlock ? selectedTextBlock.color : color

  useEffect(() => {
    if (selectedTextBlock) {
      setTextColor(selectedTextBlock.color)
      setTextFontFamily(selectedTextBlock.fontFamily)
      setTextFontSize(selectedTextBlock.fontSize)
    }
  }, [selectedTextBlock])

  const applyState = useCallback(
    (updater: CanvasState | ((previous: CanvasState) => CanvasState)) => {
      setCanvasState((previous) => {
        const resolved = typeof updater === "function" ? (updater as (prev: CanvasState) => CanvasState)(previous) : updater
        const snapshot = cloneState(resolved)
        Promise.resolve().then(() => {
          onChange?.(snapshot)
        })
        return snapshot
      })
    },
    [onChange],
  )

  const updateSelectedTextBlock = useCallback(
    (changes: Partial<CanvasTextBlock>) => {
      if (!selectedTextId) return
      applyState((previous) => {
        const next = cloneState(previous)
        next.textBlocks = (next.textBlocks ?? []).map((block) =>
          block.id === selectedTextId ? { ...block, ...changes } : block,
        )
        return next
      })
    },
    [applyState, selectedTextId],
  )

  const handleDeleteSelectedText = useCallback(() => {
    if (!selectedTextId) return
    applyState((previous) => {
      const next = cloneState(previous)
      next.textBlocks = (next.textBlocks ?? []).filter((block) => block.id !== selectedTextId)
      return next
    })
    setSelectedTextId(null)
  }, [applyState, selectedTextId])

  const updateSelectedImage = useCallback(
    (changes: Partial<CanvasImage>) => {
      if (!selectedImageId) return
      applyState((previous) => {
        const next = cloneState(previous)
        next.images = (next.images ?? []).map((image) =>
          image.id === selectedImageId ? { ...image, ...changes } : image,
        )
        return next
      })
    },
    [applyState, selectedImageId],
  )

  const handleDeleteSelectedImage = useCallback(() => {
    if (!selectedImageId) return
    applyState((previous) => {
      const next = cloneState(previous)
      next.images = (next.images ?? []).filter((image) => image.id !== selectedImageId)
      return next
    })
    delete imageCacheRef.current[selectedImageId]
    setSelectedImageId(null)
  }, [applyState, selectedImageId])

  const handleImageDimensionChange = useCallback(
    (dimension: "width" | "height", value: number) => {
      if (!selectedImage) return
      if (!Number.isFinite(value)) return
      const maxDimension = dimension === "width" ? canvasSizeRef.current.width : canvasSizeRef.current.height
      const clamped = Math.max(40, Math.min(value, maxDimension))
      updateSelectedImage({ [dimension]: clamped })
    },
    [selectedImage, updateSelectedImage],
  )

  const handleCancelPendingImage = useCallback(() => {
    if (isGeneratingImage) return
    setPendingImagePosition(null)
    setImagePrompt("")
    setImageError(null)
  }, [isGeneratingImage])

  const handleGenerateImage = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault()
      if (!pendingImagePosition) return

      const trimmedPrompt = imagePrompt.trim()
      if (trimmedPrompt.length < 5) {
        setImageError("Prompt needs a little more detail (5+ characters).")
        return
      }

      setIsGeneratingImage(true)
      setImageError(null)

      try {
        const response = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmedPrompt }),
        })

        const payload = await response.json()

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Image generation failed")
        }

        const dataUrl: string | undefined = payload.image?.dataUrl
        if (!dataUrl) {
          throw new Error("Missing image data from Gemini")
        }

        const loadedImage = await loadImageElement(dataUrl)

        const maxWidth = canvasSizeRef.current.width * 0.45
        const maxHeight = canvasSizeRef.current.height * 0.45
        const scale = Math.min(maxWidth / loadedImage.width, maxHeight / loadedImage.height, 1)

        const width = Math.max(120, loadedImage.width * scale)
        const height = Math.max(120, loadedImage.height * scale)

        const newImage: CanvasImage = {
          id: generateImageId(),
          src: dataUrl,
          x: pendingImagePosition.x - width / 2,
          y: pendingImagePosition.y - height / 2,
          width,
          height,
        }

        applyState((previous) => {
          const next = cloneState(previous)
          next.images = [...(next.images ?? []), newImage]
          return next
        })

        imageCacheRef.current[newImage.id] = loadedImage
        setSelectedImageId(newImage.id)
        setPendingImagePosition(null)
        setImagePrompt("")
      } catch (generationError) {
        console.error(generationError)
        setImageError(
          generationError instanceof Error ? generationError.message : "Something went wrong generating the image.",
        )
      } finally {
        setIsGeneratingImage(false)
      }
    },
    [applyState, imagePrompt, pendingImagePosition],
  )

  useEffect(() => {
    const parsed = parseInitialState(initialData)
    if (!statesEqual(parsed, canvasState) && !isDrawingRef.current) {
      setCanvasState(parsed)
      setSelectedTextId(null)
      setSelectedImageId(null)
      setPendingImagePosition(null)
      imageCacheRef.current = {}
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

      for (const image of images) {
        const cached = imageCacheRef.current[image.id]
        if (!cached) {
          const img = new Image()
          img.onload = () => drawScene()
          img.src = image.src
          imageCacheRef.current[image.id] = img
          continue
        }

        if (!cached.complete) {
          continue
        }

        context.drawImage(cached, image.x, image.y, image.width, image.height)

        if (selectedImageId === image.id && !readOnly) {
          context.save()
          context.strokeStyle = "#0ea5e9"
          context.lineWidth = 1.5
          context.setLineDash([6, 4])
          context.strokeRect(
            image.x - HIGHLIGHT_PADDING,
            image.y - HIGHLIGHT_PADDING,
            image.width + HIGHLIGHT_PADDING * 2,
            image.height + HIGHLIGHT_PADDING * 2,
          )
          context.restore()
        }
      }

      const blocks = canvasState.textBlocks ?? []
      for (const block of blocks) {
        context.save()
        configureTextContext(context, block)
        context.fillStyle = block.color

        const lines = block.text.split(/\n/g)
        const lineHeight = block.fontSize * LINE_HEIGHT_MULTIPLIER
        lines.forEach((line, index) => {
          const y = block.y + index * lineHeight
          context.fillText(line, block.x, y)
        })

        if (selectedTextId === block.id && !readOnly) {
          const bounds = getTextBounds(context, block)
          context.strokeStyle = "#6366f1"
          context.lineWidth = 1
          context.setLineDash([6, 4])
          context.strokeRect(
            bounds.x - HIGHLIGHT_PADDING,
            bounds.y - HIGHLIGHT_PADDING,
            bounds.width + HIGHLIGHT_PADDING * 2,
            bounds.height + HIGHLIGHT_PADDING * 2,
          )
        }

        context.restore()
      }
    },
    [canvasState, images, readOnly, selectedImageId, selectedTextId],
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

      const coordinates = getCanvasCoordinates(event, canvas, canvasSizeRef.current)

      if (tool === "image") {
        setSelectedTextId(null)
        setImageError(null)

        for (let index = images.length - 1; index >= 0; index -= 1) {
          const image = images[index]
          const bounds = { x: image.x, y: image.y, width: image.width, height: image.height }
          if (pointInBounds(coordinates, bounds)) {
            setSelectedImageId(image.id)
            isDraggingImageRef.current = true
            imageDragRef.current = {
              id: image.id,
              offsetX: coordinates.x - image.x,
              offsetY: coordinates.y - image.y,
            }
            textDragRef.current = null
            activePointerRef.current = event.pointerId
            canvas.setPointerCapture(event.pointerId)
            setPendingImagePosition(null)
            return
          }
        }

        setSelectedImageId(null)
        setPendingImagePosition({ x: coordinates.x, y: coordinates.y })
        return
      }

      if (tool === "text") {
        const context = canvas.getContext("2d")
        if (!context) return

        for (let index = textBlocks.length - 1; index >= 0; index -= 1) {
          const block = textBlocks[index]
          const bounds = getTextBounds(context, block)
          if (pointInBounds(coordinates, bounds)) {
            setSelectedTextId(block.id)
            setSelectedImageId(null)
            textDragRef.current = {
              id: block.id,
              offsetX: coordinates.x - block.x,
              offsetY: coordinates.y - block.y,
            }
            isDraggingTextRef.current = true
            activePointerRef.current = event.pointerId
            canvas.setPointerCapture(event.pointerId)
            setPendingImagePosition(null)
            return
          }
        }

        const newBlock: CanvasTextBlock = {
          id: generateTextId(),
          text: "New text",
          x: coordinates.x,
          y: coordinates.y,
          color: textColor,
          fontSize: textFontSize,
          fontFamily: textFontFamily,
          align: "left",
        }

        applyState((previous) => {
          const next = cloneState(previous)
          next.textBlocks = [...(next.textBlocks ?? []), newBlock]
          return next
        })
        setSelectedTextId(newBlock.id)
        setSelectedImageId(null)
        setPendingImagePosition(null)
        return
      }

      if (tool !== "pen" && tool !== "eraser") {
        return
      }

      setSelectedTextId(null)
      setSelectedImageId(null)
      setPendingImagePosition(null)

      canvas.setPointerCapture(event.pointerId)
      activePointerRef.current = event.pointerId

      const nextStroke: CanvasStroke = {
        id: generateStrokeId(),
        color: tool === "eraser" ? "#ffffff" : color,
        width: strokeWidth,
        points: [coordinates],
      }

      isDrawingRef.current = true
      currentStrokeRef.current = nextStroke
      drawScene(nextStroke)
    },
    [applyState, color, drawScene, images, readOnly, strokeWidth, textBlocks, textColor, textFontFamily, textFontSize, tool],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (isDraggingImageRef.current) {
        if (activePointerRef.current !== null && activePointerRef.current !== event.pointerId) {
          return
        }

        const canvas = canvasRef.current
        const dragMeta = imageDragRef.current
        if (!canvas || !dragMeta) return

        const coordinates = getCanvasCoordinates(event, canvas, canvasSizeRef.current)
        applyState((previous) => {
          const next = cloneState(previous)
          next.images = (next.images ?? []).map((image) =>
            image.id === dragMeta.id
              ? {
                  ...image,
                  x: coordinates.x - dragMeta.offsetX,
                  y: coordinates.y - dragMeta.offsetY,
                }
              : image,
          )
          return next
        })
        return
      }

      if (isDraggingTextRef.current) {
        if (activePointerRef.current !== null && activePointerRef.current !== event.pointerId) {
          return
        }

        const canvas = canvasRef.current
        const dragMeta = textDragRef.current
        if (!canvas || !dragMeta) return

        const coordinates = getCanvasCoordinates(event, canvas, canvasSizeRef.current)
        applyState((previous) => {
          const next = cloneState(previous)
          next.textBlocks = (next.textBlocks ?? []).map((block) =>
            block.id === dragMeta.id
              ? {
                  ...block,
                  x: coordinates.x - dragMeta.offsetX,
                  y: coordinates.y - dragMeta.offsetY,
                }
              : block,
          )
          return next
        })
        return
      }

      if (!isDrawingRef.current) return
      if (activePointerRef.current !== null && activePointerRef.current !== event.pointerId) {
        return
      }

      const canvas = canvasRef.current
      const stroke = currentStrokeRef.current
      if (!canvas || !stroke) return

      const coordinates = getCanvasCoordinates(event, canvas, canvasSizeRef.current)
      stroke.points.push(coordinates)
      drawScene(stroke)
    },
    [applyState, drawScene],
  )

  const endStroke = useCallback(
    (event: PointerEvent) => {
      if (isDraggingImageRef.current) {
        const canvas = canvasRef.current
        if (canvas && canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId)
        }
        isDraggingImageRef.current = false
        imageDragRef.current = null
        activePointerRef.current = null
        return
      }

      if (isDraggingTextRef.current) {
        const canvas = canvasRef.current
        if (canvas && canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId)
        }
        isDraggingTextRef.current = false
        textDragRef.current = null
        activePointerRef.current = null
        return
      }

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
    if (canvasState.strokes.length > 0) {
      applyState({
        ...canvasState,
        strokes: canvasState.strokes.slice(0, -1),
      })
      return
    }

    const textBlocks = canvasState.textBlocks ?? []
    if (textBlocks.length > 0) {
      const updated = textBlocks.slice(0, -1)
      applyState({
        ...canvasState,
        textBlocks: updated,
      })
      if (selectedTextId && !updated.some((block) => block.id === selectedTextId)) {
        setSelectedTextId(null)
      }
      return
    }

    const currentImages = canvasState.images ?? []
    if (currentImages.length > 0) {
      const updatedImages = currentImages.slice(0, -1)
      const removed = currentImages[currentImages.length - 1]
      applyState({
        ...canvasState,
        images: updatedImages,
      })
      if (removed) {
        delete imageCacheRef.current[removed.id]
      }
      if (selectedImageId && !updatedImages.some((image) => image.id === selectedImageId)) {
        setSelectedImageId(null)
      }
    }
  }, [applyState, canvasState, selectedImageId, selectedTextId])

  const handleClear = useCallback(() => {
    applyState({
      ...canvasState,
      strokes: [],
      textBlocks: [],
      images: [],
    })
    setSelectedTextId(null)
    setSelectedImageId(null)
    setPendingImagePosition(null)
    imageCacheRef.current = {}
  }, [applyState, canvasState])

  const handleSave = useCallback(() => {
    setCanvasState((previous) => {
      const snapshot = cloneState(previous)
      onSave?.(snapshot)
      return snapshot
    })
  }, [onSave])

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
                <Button
                  size="sm"
                  variant={tool === "text" ? "default" : "outline"}
                  onClick={() => setTool("text")}
                >
                  Text
                </Button>
                <Button
                  size="sm"
                  variant={tool === "image" ? "default" : "outline"}
                  onClick={() => {
                    setTool("image")
                    setSelectedTextId(null)
                  }}
                >
                  Image
                </Button>
              </div>

              <div className="flex items-center gap-1">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => {
                      if (selectedTextBlock) {
                        setTextColor(swatch)
                        updateSelectedTextBlock({ color: swatch })
                        return
                      }

                      if (tool === "text") {
                        setTextColor(swatch)
                        return
                      }

                      setTool("pen")
                      setColor(swatch)
                    }}
                    className={cn(
                      "size-6 rounded-full border border-border transition",
                      activeColor === swatch ? "ring-2 ring-offset-2 ring-offset-background" : "",
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

      {!readOnly && pendingImagePosition && (
        <div className="border-b border-dashed border-border bg-muted/40 p-4 space-y-4">
          <form className="space-y-3" onSubmit={(event) => handleGenerateImage(event)}>
            <div className="space-y-2">
              <Label htmlFor="canvas-image-prompt">Image Prompt</Label>
              <Textarea
                id="canvas-image-prompt"
                value={imagePrompt}
                onChange={(event) => setImagePrompt(event.target.value)}
                rows={2}
                placeholder="Describe the visual you want Gemini to generate..."
              />
              <p className="text-xs text-muted-foreground">
                Placing image near ({Math.round(pendingImagePosition.x)}, {Math.round(pendingImagePosition.y)})
              </p>
              {imageError && <p className="text-xs font-medium text-destructive">{imageError}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={isGeneratingImage}>
                {isGeneratingImage ? "Generating..." : "Generate Image"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleCancelPendingImage}
                disabled={isGeneratingImage}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {!readOnly && selectedTextBlock && (
        <div className="border-b border-dashed border-border bg-muted/40 p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="canvas-text-content">Text Content</Label>
              <Textarea
                id="canvas-text-content"
                value={selectedTextBlock.text}
                onChange={(event) => {
                  const value = event.target.value.slice(0, 280)
                  updateSelectedTextBlock({ text: value })
                }}
                rows={3}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">{selectedTextBlock.text.length}/280 characters</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="canvas-text-font">Font</Label>
                <select
                  id="canvas-text-font"
                  value={textFontFamily}
                  onChange={(event) => {
                    const font = event.target.value as CanvasTextBlock["fontFamily"]
                    setTextFontFamily(font)
                    updateSelectedTextBlock({ fontFamily: font })
                  }}
                  className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
                >
                  {TEXT_FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="canvas-text-size">Size</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="canvas-text-size"
                    type="range"
                    min={12}
                    max={96}
                    value={textFontSize}
                    onChange={(event) => {
                      const size = Number(event.target.value)
                      setTextFontSize(size)
                      updateSelectedTextBlock({ fontSize: size })
                    }}
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-xs font-mono">{textFontSize}px</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Alignment</Label>
                <div className="flex gap-2">
                  {(["left", "center", "right"] as const).map((alignment) => (
                    <Button
                      key={alignment}
                      size="sm"
                      variant={selectedTextBlock.align === alignment ? "default" : "outline"}
                      onClick={() => updateSelectedTextBlock({ align: alignment })}
                    >
                      {alignment === "left" ? "Left" : alignment === "center" ? "Center" : "Right"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs uppercase text-muted-foreground">Text Color</Label>
              <div className="flex items-center gap-1">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => {
                      setTextColor(swatch)
                      updateSelectedTextBlock({ color: swatch })
                    }}
                    className={cn(
                      "size-6 rounded-full border border-border transition",
                      selectedTextBlock.color === swatch ? "ring-2 ring-offset-2 ring-offset-background" : "",
                    )}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Change text color to ${swatch}`}
                  />
                ))}
              </div>
            </div>
            <Button type="button" size="sm" variant="destructive" onClick={handleDeleteSelectedText}>
              Delete Text
            </Button>
          </div>
        </div>
      )}

      {!readOnly && selectedImage && (
        <div className="border-b border-dashed border-border bg-muted/40 p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Image Details</Label>
              <div className="rounded border border-border bg-background px-3 py-2 text-xs font-mono text-muted-foreground">
                <div>
                  Position: ({Math.round(selectedImage.x)}, {Math.round(selectedImage.y)})
                </div>
                <div>
                  Size: {Math.round(selectedImage.width)} × {Math.round(selectedImage.height)} px
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="canvas-image-width">Width</Label>
                <input
                  id="canvas-image-width"
                  type="number"
                  min={40}
                  max={canvasSizeRef.current.width}
                  value={Math.round(selectedImage.width)}
                  onChange={(event) => handleImageDimensionChange("width", Number(event.target.value))}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="canvas-image-height">Height</Label>
                <input
                  id="canvas-image-height"
                  type="number"
                  min={40}
                  max={canvasSizeRef.current.height}
                  value={Math.round(selectedImage.height)}
                  onChange={(event) => handleImageDimensionChange("height", Number(event.target.value))}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Drag directly on the canvas to move the image. Adjust width and height to resize as needed.
              </p>
              <Button type="button" variant="destructive" size="sm" onClick={handleDeleteSelectedImage}>
                Delete Image
              </Button>
            </div>
          </div>
        </div>
      )}

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
