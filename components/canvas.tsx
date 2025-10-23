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
type ResizeHandle = "top-left" | "top-right" | "bottom-left" | "bottom-right"
type ImageResizeHandle = ResizeHandle
type TextResizeHandle = ResizeHandle

const DEFAULT_SIZE = { width: 1600, height: 900 }
const DEFAULT_STROKE_COLOR = "#111827"
const DEFAULT_STROKE_WIDTH = 6
const DEFAULT_TEXT_COLOR = "#111827"
const DEFAULT_TEXT_FONT: CanvasTextBlock["fontFamily"] = "Space Grotesk"
const DEFAULT_TEXT_SIZE = 40
const IMAGE_HANDLE_SIZE = 12
const MIN_IMAGE_SIZE = 48
const TEXT_HANDLE_SIZE = 12
const MIN_TEXT_BOX_SIZE = 32
const MIN_TEXT_FONT_SIZE = 12
const MAX_TEXT_FONT_SIZE = 96

const COLOR_SWATCHES = ["#111827", "#ffffff", "#1d4ed8", "#ea580c", "#ca8a04", "#16a34a", "#db2777", "#6b21a8"]
const STROKE_WIDTHS = [
  { label: "Small", value: 6 },
  { label: "Medium", value: 12 },
  { label: "Large", value: 24 },
]
const TEXT_FONT_OPTIONS: Array<{ label: string; value: CanvasTextBlock["fontFamily"] }> = [
  { label: "Sans", value: "Space Grotesk" },
  { label: "Serif", value: "Georgia" },
  { label: "Mono", value: "IBM Plex Mono" },
  { label: "Display", value: "Impact" },
]

const TEXT_SIZE_PRESETS = [
  { label: "Tiny", value: 20 },
  { label: "Small", value: 32 },
  { label: "Medium", value: 48 },
  { label: "Large", value: 64 },
  { label: "Huge", value: 80 },
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

function getTextScreenPosition(textBlock: CanvasTextBlock, canvas: HTMLCanvasElement, canvasSize = DEFAULT_SIZE) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width / canvasSize.width
  const scaleY = rect.height / canvasSize.height

  const screenX = rect.left + textBlock.x * scaleX
  const screenY = rect.top + (textBlock.y - textBlock.fontSize) * scaleY

  return { screenX, screenY }
}

const LINE_HEIGHT_MULTIPLIER = 1.2
const HIGHLIGHT_PADDING = 6

function configureTextContext(context: CanvasRenderingContext2D, block: CanvasTextBlock) {
  // Quote font family names that contain spaces for canvas compatibility
  const fontFamily = block.fontFamily.includes(' ') ? `"${block.fontFamily}"` : block.fontFamily
  context.font = `${block.fontSize}px ${fontFamily}, sans-serif`
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
    // Ensure we get a valid width, even if measureText fails
    const width = isNaN(metrics.width) || metrics.width === 0 ? block.fontSize * (line || " ").length * 0.6 : metrics.width
    maxWidth = Math.max(maxWidth, width)
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

function getImageHandlePositions(image: CanvasImage) {
  const left = image.x - HIGHLIGHT_PADDING
  const right = image.x + image.width + HIGHLIGHT_PADDING
  const top = image.y - HIGHLIGHT_PADDING
  const bottom = image.y + image.height + HIGHLIGHT_PADDING

  return [
    { handle: "top-left" as const, x: left, y: top },
    { handle: "top-right" as const, x: right, y: top },
    { handle: "bottom-left" as const, x: left, y: bottom },
    { handle: "bottom-right" as const, x: right, y: bottom },
  ]
}

function getHandleBounds(x: number, y: number, size = IMAGE_HANDLE_SIZE) {
  return {
    x: x - size / 2,
    y: y - size / 2,
    width: size,
    height: size,
  }
}

function getHandleAtPoint(image: CanvasImage, point: { x: number; y: number }): ImageResizeHandle | null {
  for (const position of getImageHandlePositions(image)) {
    const bounds = getHandleBounds(position.x, position.y)
    if (pointInBounds(point, bounds)) {
      return position.handle
    }
  }
  return null
}

function getTextHandlePositions(bounds: { x: number; y: number; width: number; height: number }) {
  const left = bounds.x - HIGHLIGHT_PADDING
  const right = bounds.x + bounds.width + HIGHLIGHT_PADDING
  const top = bounds.y - HIGHLIGHT_PADDING
  const bottom = bounds.y + bounds.height + HIGHLIGHT_PADDING

  return [
    { handle: "top-left" as const, x: left, y: top },
    { handle: "top-right" as const, x: right, y: top },
    { handle: "bottom-left" as const, x: left, y: bottom },
    { handle: "bottom-right" as const, x: right, y: bottom },
  ]
}

function getTextHandleAtPoint(
  bounds: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number },
): TextResizeHandle | null {
  for (const position of getTextHandlePositions(bounds)) {
    const handleBounds = getHandleBounds(position.x, position.y, TEXT_HANDLE_SIZE)
    if (pointInBounds(point, handleBounds)) {
      return position.handle
    }
  }
  return null
}

function getResizedRect(
  meta: {
    handle: ResizeHandle
    originX: number
    originY: number
    startX: number
    startY: number
    startWidth: number
    startHeight: number
  },
  point: { x: number; y: number },
  { minWidth = 0, minHeight = 0, preserveAspectRatio = false }: { minWidth?: number; minHeight?: number; preserveAspectRatio?: boolean } = {},
) {
  const dx = point.x - meta.originX
  const dy = point.y - meta.originY

  let x = meta.startX
  let y = meta.startY
  let width = meta.startWidth
  let height = meta.startHeight

  if (preserveAspectRatio) {
    // Calculate aspect ratio from original dimensions
    const aspectRatio = meta.startWidth / meta.startHeight

    // Use the largest dimension change to maintain proportions
    const distance = Math.sqrt(dx * dx + dy * dy)
    const direction = dx + dy >= 0 ? 1 : -1

    switch (meta.handle) {
      case "top-left":
        width = meta.startWidth - direction * distance / Math.sqrt(1 + 1 / (aspectRatio * aspectRatio))
        height = width / aspectRatio
        x = meta.startX + (meta.startWidth - width)
        y = meta.startY + (meta.startHeight - height)
        break
      case "top-right":
        width = meta.startWidth + direction * distance / Math.sqrt(1 + 1 / (aspectRatio * aspectRatio))
        height = width / aspectRatio
        y = meta.startY + (meta.startHeight - height)
        break
      case "bottom-left":
        width = meta.startWidth - direction * distance / Math.sqrt(1 + 1 / (aspectRatio * aspectRatio))
        height = width / aspectRatio
        x = meta.startX + (meta.startWidth - width)
        break
      case "bottom-right":
        width = meta.startWidth + direction * distance / Math.sqrt(1 + 1 / (aspectRatio * aspectRatio))
        height = width / aspectRatio
        break
      default:
        break
    }
  } else {
    switch (meta.handle) {
      case "top-left":
        width = meta.startWidth - dx
        height = meta.startHeight - dy
        x = meta.startX + dx
        y = meta.startY + dy
        break
      case "top-right":
        width = meta.startWidth + dx
        height = meta.startHeight - dy
        y = meta.startY + dy
        break
      case "bottom-left":
        width = meta.startWidth - dx
        height = meta.startHeight + dy
        x = meta.startX + dx
        break
      case "bottom-right":
        width = meta.startWidth + dx
        height = meta.startHeight + dy
        break
      default:
        break
    }
  }

  if (width < minWidth) {
    width = minWidth
    if (preserveAspectRatio) {
      height = width / (meta.startWidth / meta.startHeight)
    }
    if (meta.handle === "top-left" || meta.handle === "bottom-left") {
      x = meta.startX + (meta.startWidth - width)
    } else {
      x = meta.startX
    }
  }

  if (height < minHeight) {
    height = minHeight
    if (preserveAspectRatio) {
      width = height * (meta.startWidth / meta.startHeight)
    }
    if (meta.handle === "top-left" || meta.handle === "top-right") {
      y = meta.startY + (meta.startHeight - height)
    } else {
      y = meta.startY
    }
  }

  return { x, y, width, height }
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
  const [promptBoxPosition, setPromptBoxPosition] = useState<{ x: number; y: number } | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<CanvasStroke | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const isDraggingTextRef = useRef(false)
  const textDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const canvasSizeRef = useRef(DEFAULT_SIZE)
  const isDraggingImageRef = useRef(false)
  const imageDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const imageResizeRef = useRef<{
    id: string
    handle: ImageResizeHandle
    originX: number
    originY: number
    startX: number
    startY: number
    startWidth: number
    startHeight: number
  } | null>(null)
  const textResizeRef = useRef<{
    id: string
    handle: TextResizeHandle
    originX: number
    originY: number
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    startFontSize: number
    align: CanvasTextBlock["align"]
  } | null>(null)
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

  const selectedTextBlock = useMemo(() => {
    console.log('[TEXT-DEBUG] selectedTextBlock useMemo calculating', {
      selectedTextId,
      textBlocksCount: textBlocks.length,
      textBlockIds: textBlocks.map(b => b.id)
    })
    const result = textBlocks.find((block) => block.id === selectedTextId) ?? null
    console.log('[TEXT-DEBUG] selectedTextBlock result:', result ? result.id : 'null')
    return result
  }, [selectedTextId, textBlocks])

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

  // Auto-select newly created text blocks
  const prevTextBlockCountRef = useRef(textBlockCount)
  useEffect(() => {
    console.log('[TEXT-DEBUG] Auto-select useEffect running', {
      tool,
      textBlockCount,
      prevCount: prevTextBlockCountRef.current,
      willSelect: tool === "text" && textBlockCount > prevTextBlockCountRef.current && textBlocks.length > 0
    })
    // If a new text block was just added and we're using the text tool, select the last block
    if (tool === "text" && textBlockCount > prevTextBlockCountRef.current && textBlocks.length > 0) {
      const lastBlock = textBlocks[textBlocks.length - 1]
      console.log('[TEXT-DEBUG] Auto-selecting last block:', lastBlock.id)
      setSelectedTextId(lastBlock.id)
    }
    prevTextBlockCountRef.current = textBlockCount
  }, [textBlockCount, textBlocks, tool])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
    }

    if (showColorPicker) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showColorPicker])

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

  const handleColorPickerClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const width = rect.width

    // Create a gradient from black through rainbow to white
    const hue = (x / width) * 360

    // Convert HSL to hex
    const h = hue / 60
    const c = 1
    const xVal = c * (1 - Math.abs((h % 2) - 1))
    const m = 0

    let r = 0, g = 0, b = 0
    if (h >= 0 && h < 1) { r = c; g = xVal; b = 0 }
    else if (h >= 1 && h < 2) { r = xVal; g = c; b = 0 }
    else if (h >= 2 && h < 3) { r = 0; g = c; b = xVal }
    else if (h >= 3 && h < 4) { r = 0; g = xVal; b = c }
    else if (h >= 4 && h < 5) { r = xVal; g = 0; b = c }
    else if (h >= 5 && h < 6) { r = c; g = 0; b = xVal }

    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)

    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`

    if (selectedTextBlock) {
      setTextColor(hexColor)
      updateSelectedTextBlock({ color: hexColor })
    } else if (tool === "text") {
      setTextColor(hexColor)
    } else {
      setTool("pen")
      setColor(hexColor)
    }
  }, [selectedTextBlock, tool, updateSelectedTextBlock])

  const handleDeleteSelectedText = useCallback(() => {
    if (!selectedTextId) return
    applyState((previous) => {
      const next = cloneState(previous)
      next.textBlocks = (next.textBlocks ?? []).filter((block) => block.id !== selectedTextId)
      return next
    })
    console.log('[TEXT-DEBUG] setSelectedTextId(null) - delete text handler')
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
    setPromptBoxPosition(null)
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
        setPromptBoxPosition(null)
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
    // Skip updating if we're actively editing text or images (user-initiated changes in progress)
    const isActivelyEditing = selectedTextId !== null || selectedImageId !== null
    console.log('[TEXT-DEBUG] initialData effect check', {
      statesEqual: statesEqual(parsed, canvasState),
      isDrawing: isDrawingRef.current,
      isActivelyEditing,
      selectedTextId,
      selectedImageId
    })
    if (!statesEqual(parsed, canvasState) && !isDrawingRef.current && !isActivelyEditing) {
      console.log('[TEXT-DEBUG] Applying initialData update (no active editing)')
      setCanvasState(parsed)
      setSelectedTextId(null)
      setSelectedImageId(null)
      setPendingImagePosition(null)
      imageCacheRef.current = {}
    } else if (isActivelyEditing) {
      console.log('[TEXT-DEBUG] Skipping initialData update - actively editing')
    }
    // Only react when caller provides new data — ignore onChange dependency
    // Note: We intentionally do NOT include selectedTextId/selectedImageId as dependencies
    // because we only want this to fire when initialData changes from external sources
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
          context.setLineDash([])
          context.lineWidth = 1
          context.fillStyle = "#ffffff"
          const handles = getImageHandlePositions(image)
          for (const handle of handles) {
            const bounds = getHandleBounds(handle.x, handle.y)
            context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
            context.strokeStyle = "#0ea5e9"
            context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
          }
          context.restore()
        }
      }

      const blocks = canvasState.textBlocks ?? []
      for (const block of blocks) {
        context.save()
        configureTextContext(context, block)
        context.fillStyle = block.color

        // Skip rendering text content if it's selected (textarea overlay will show it)
        // But still render selection box and handles
        const isSelected = selectedTextId === block.id && !readOnly

        if (!isSelected) {
          const lines = block.text.split(/\n/g)
          const lineHeight = block.fontSize * LINE_HEIGHT_MULTIPLIER
          lines.forEach((line, index) => {
            const y = block.y + index * lineHeight
            context.fillText(line, block.x, y)
          })
        }

        if (isSelected) {
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
          context.setLineDash([])
          context.fillStyle = "#ffffff"
          const handles = getTextHandlePositions(bounds)
          for (const handle of handles) {
            const handleBounds = getHandleBounds(handle.x, handle.y, TEXT_HANDLE_SIZE)
            context.fillRect(handleBounds.x, handleBounds.y, handleBounds.width, handleBounds.height)
            context.strokeStyle = "#6366f1"
            context.strokeRect(handleBounds.x, handleBounds.y, handleBounds.width, handleBounds.height)
          }
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
        console.log('[TEXT-DEBUG] setSelectedTextId(null) - image tool pointerdown')
        setSelectedTextId(null)
        setImageError(null)

        if (selectedImage) {
          const handle = getHandleAtPoint(selectedImage, coordinates)
          if (handle) {
            setSelectedImageId(selectedImage.id)
            imageDragRef.current = null
            isDraggingImageRef.current = false
            imageResizeRef.current = {
              id: selectedImage.id,
              handle,
              originX: coordinates.x,
              originY: coordinates.y,
              startX: selectedImage.x,
              startY: selectedImage.y,
              startWidth: selectedImage.width,
              startHeight: selectedImage.height,
            }
            activePointerRef.current = event.pointerId
            canvas.setPointerCapture(event.pointerId)
            setPendingImagePosition(null)
            return
          }
        }

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

        // Calculate screen position for prompt box (relative to canvas container)
        const rect = canvas.getBoundingClientRect()
        const screenX = event.clientX - rect.left
        const screenY = event.clientY - rect.top
        setPromptBoxPosition({ x: screenX, y: screenY })
        return
      }

      if (tool === "text") {
        const context = canvas.getContext("2d")
        if (!context) return

        if (selectedTextBlock) {
          const bounds = getTextBounds(context, selectedTextBlock)
          const handle = getTextHandleAtPoint(bounds, coordinates)
          if (handle) {
            console.log('[TEXT-DEBUG] setSelectedTextId - text resize handle clicked:', selectedTextBlock.id)
            setSelectedTextId(selectedTextBlock.id)
            setSelectedImageId(null)
            textResizeRef.current = {
              id: selectedTextBlock.id,
              handle,
              originX: coordinates.x,
              originY: coordinates.y,
              startX: bounds.x,
              startY: bounds.y,
              startWidth: bounds.width,
              startHeight: bounds.height,
              startFontSize: selectedTextBlock.fontSize,
              align: selectedTextBlock.align,
            }
            textDragRef.current = null
            isDraggingTextRef.current = false
            activePointerRef.current = event.pointerId
            canvas.setPointerCapture(event.pointerId)
            setPendingImagePosition(null)
            return
          }
        }

        // Check if clicking on an existing text block
        for (let index = textBlocks.length - 1; index >= 0; index -= 1) {
          const block = textBlocks[index]
          const bounds = getTextBounds(context, block)
          if (pointInBounds(coordinates, bounds)) {
            console.log('[TEXT-DEBUG] setSelectedTextId - existing text block clicked:', block.id)
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

        // If text is already selected, clicking empty space deselects (finalizes) it
        if (selectedTextId !== null) {
          console.log('[TEXT-DEBUG] setSelectedTextId(null) - clicking empty space to finalize text')
          setSelectedTextId(null)
          setSelectedImageId(null)
          setPendingImagePosition(null)
          return
        }

        // Create new text when clicking on empty space (only if no text is selected)
        // The useEffect will auto-select it after it's added to the state
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

        console.log('[TEXT-DEBUG] Creating new text block:', newBlock.id)
        applyState((previous) => {
          const next = cloneState(previous)
          next.textBlocks = [...(next.textBlocks ?? []), newBlock]
          console.log('[TEXT-DEBUG] applyState - new textBlocks count:', next.textBlocks.length)
          return next
        })
        setSelectedImageId(null)
        setPendingImagePosition(null)
        return
      }

      if (tool !== "pen" && tool !== "eraser") {
        return
      }

      console.log('[TEXT-DEBUG] setSelectedTextId(null) - pen/eraser tool pointerdown')
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
    [
      applyState,
      color,
      drawScene,
      images,
      readOnly,
      selectedImage,
      strokeWidth,
      textBlocks,
      selectedTextBlock,
      textColor,
      textFontFamily,
      textFontSize,
      tool,
    ],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (readOnly) return

      // Update cursor position for eraser and pen cursor visualization
      if (tool === "eraser" || tool === "pen") {
        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          setCursorPosition({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          })
        }
      }

      if (imageResizeRef.current) {
        if (activePointerRef.current !== null && activePointerRef.current !== event.pointerId) {
          return
        }

        const canvas = canvasRef.current
        const resizeMeta = imageResizeRef.current
        if (!canvas || !resizeMeta) return

        const coordinates = getCanvasCoordinates(event, canvas, canvasSizeRef.current)
        const dimensions = getResizedRect(resizeMeta, coordinates, {
          minWidth: MIN_IMAGE_SIZE,
          minHeight: MIN_IMAGE_SIZE,
          preserveAspectRatio: event.shiftKey,
        })
        applyState((previous) => {
          const next = cloneState(previous)
          next.images = (next.images ?? []).map((image) =>
            image.id === resizeMeta.id
              ? {
                  ...image,
                  x: dimensions.x,
                  y: dimensions.y,
                  width: dimensions.width,
                  height: dimensions.height,
                }
              : image,
          )
          return next
        })
        return
      }

      if (textResizeRef.current) {
        if (activePointerRef.current !== null && activePointerRef.current !== event.pointerId) {
          return
        }

        const canvas = canvasRef.current
        const resizeMeta = textResizeRef.current
        if (!canvas || !resizeMeta) return

        const coordinates = getCanvasCoordinates(event, canvas, canvasSizeRef.current)
        const rect = getResizedRect(resizeMeta, coordinates, {
          minWidth: MIN_TEXT_BOX_SIZE,
          minHeight: MIN_TEXT_BOX_SIZE,
        })

        const baseWidth = Math.max(1, resizeMeta.startWidth)
        const baseHeight = Math.max(1, resizeMeta.startHeight)
        const widthScale = rect.width / baseWidth
        const heightScale = rect.height / baseHeight
        const scale = Math.max(widthScale, heightScale)
        const nextFontSize = Math.min(
          MAX_TEXT_FONT_SIZE,
          Math.max(MIN_TEXT_FONT_SIZE, Math.round(resizeMeta.startFontSize * scale)),
        )

        const top = rect.y
        const left = rect.x
        const width = rect.width

        applyState((previous) => {
          const next = cloneState(previous)
          next.textBlocks = (next.textBlocks ?? []).map((block) => {
            if (block.id !== resizeMeta.id) {
              return block
            }

            let nextX = left
            if (resizeMeta.align === "center") {
              nextX = left + width / 2
            } else if (resizeMeta.align === "right") {
              nextX = left + width
            }

            return {
              ...block,
              x: nextX,
              y: top + nextFontSize,
              fontSize: nextFontSize,
            }
          })
          return next
        })

        setTextFontSize(nextFontSize)
        return
      }

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
    [applyState, drawScene, readOnly, tool],
  )

  const endStroke = useCallback(
    (event: PointerEvent) => {
      // Clear cursor position when pointer leaves canvas
      if (event.type === "pointerleave" || event.type === "pointercancel") {
        setCursorPosition(null)
      }

      if (textResizeRef.current) {
        const canvas = canvasRef.current
        if (canvas && canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId)
        }
        textResizeRef.current = null
        activePointerRef.current = null
        return
      }

      if (imageResizeRef.current) {
        const canvas = canvasRef.current
        if (canvas && canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId)
        }
        imageResizeRef.current = null
        activePointerRef.current = null
        return
      }

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
        console.log('[TEXT-DEBUG] setSelectedTextId(null) - undo removed selected text')
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
    console.log('[TEXT-DEBUG] setSelectedTextId(null) - clear canvas')
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

  // Clear cursor position when tool changes away from eraser or pen
  useEffect(() => {
    if (tool !== "eraser" && tool !== "pen") {
      setCursorPosition(null)
    }
  }, [tool])

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
                  title="Pen"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M14 2 L18 6 L6 18 L2 18 L2 14 Z"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 14 L6 18"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  </svg>
                </Button>
                <Button
                  size="sm"
                  variant={tool === "eraser" ? "default" : "outline"}
                  onClick={() => setTool("eraser")}
                  title="Eraser"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                    <path d="M22 21H7" />
                    <path d="m5 11 9 9" />
                  </svg>
                </Button>
                <Button
                  size="sm"
                  variant={tool === "text" ? "default" : "outline"}
                  onClick={() => setTool("text")}
                  title="Text"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line x1="9" y1="20" x2="15" y2="20" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                  </svg>
                </Button>
                <Button
                  size="sm"
                  variant={tool === "image" ? "default" : "outline"}
                  onClick={() => {
                    setTool("image")
                    console.log('[TEXT-DEBUG] setSelectedTextId(null) - image tool button clicked')
                    setSelectedTextId(null)
                  }}
                  title="Image"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </Button>
              </div>

              <div className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex h-8 items-center gap-2 rounded border-2 border-border bg-background px-2 transition hover:bg-muted"
                  aria-label="Color picker"
                >
                  <div
                    className="size-5 rounded-full border-2 border-border"
                    style={{ backgroundColor: activeColor }}
                  />
                  <span className="text-xs font-semibold">Color</span>
                </button>

                {showColorPicker && (
                  <div
                    ref={colorPickerRef}
                    className="retro-border absolute left-0 top-10 z-20 bg-background p-3 shadow-lg"
                  >
                    <div className="space-y-2">
                      <div
                        onClick={handleColorPickerClick}
                        className="relative h-8 w-64 cursor-crosshair rounded border-2 border-border"
                        style={{
                          background: "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
                        }}
                      >
                        <div
                          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
                          style={{
                            backgroundColor: activeColor,
                            left: `${(() => {
                              // Calculate position based on current color
                              const hex = activeColor.replace('#', '')
                              const r = parseInt(hex.substring(0, 2), 16) / 255
                              const g = parseInt(hex.substring(2, 4), 16) / 255
                              const b = parseInt(hex.substring(4, 6), 16) / 255
                              const max = Math.max(r, g, b)
                              const min = Math.min(r, g, b)
                              const delta = max - min
                              if (delta === 0) return 0
                              let hue = 0
                              if (max === r) hue = ((g - b) / delta) % 6
                              else if (max === g) hue = (b - r) / delta + 2
                              else hue = (r - g) / delta + 4
                              hue = Math.round(hue * 60)
                              if (hue < 0) hue += 360
                              return (hue / 360) * 100
                            })()}%`,
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-8 gap-1.5">
                        {COLOR_SWATCHES.map((swatch) => (
                          <button
                            key={swatch}
                            type="button"
                            onClick={() => {
                              if (selectedTextBlock) {
                                setTextColor(swatch)
                                updateSelectedTextBlock({ color: swatch })
                              } else if (tool === "text") {
                                setTextColor(swatch)
                              } else {
                                setTool("pen")
                                setColor(swatch)
                              }
                            }}
                            className={cn(
                              "size-6 rounded border border-border transition hover:scale-110",
                              activeColor === swatch ? "ring-2 ring-foreground" : "",
                            )}
                            style={{ backgroundColor: swatch }}
                            aria-label={`Use ${swatch} ink`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {STROKE_WIDTHS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setStrokeWidth(preset.value)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded border-2 border-border bg-background transition hover:bg-muted",
                      strokeWidth === preset.value ? "border-foreground ring-2 ring-foreground ring-offset-2" : "",
                    )}
                    aria-label={`Brush width ${preset.value}px`}
                  >
                    <div
                      className="rounded-full bg-foreground"
                      style={{
                        width: `${preset.value}px`,
                        height: `${preset.value}px`,
                      }}
                    />
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
          className={cn(
            "h-full w-full touch-none",
            readOnly && "pointer-events-none",
            tool === "image" && !pendingImagePosition && !selectedImageId && "cursor-crosshair",
            tool === "eraser" && "cursor-none",
            tool === "pen" && "cursor-none",
          )}
        />

        {/* Custom eraser cursor */}
        {!readOnly && tool === "eraser" && cursorPosition && canvasRef.current && (
          <div
            className="pointer-events-none absolute z-30 rounded-full border-2 border-foreground"
            style={{
              left: `${cursorPosition.x}px`,
              top: `${cursorPosition.y}px`,
              width: `${strokeWidth}px`,
              height: `${strokeWidth}px`,
              transform: "translate(-50%, -50%)",
              backgroundColor: "rgba(255, 255, 255, 0.5)",
            }}
          />
        )}

        {/* Custom pen cursor */}
        {!readOnly && tool === "pen" && cursorPosition && canvasRef.current && (
          <div
            className="pointer-events-none absolute z-30"
            style={{
              left: `${cursorPosition.x - 2}px`,
              top: `${cursorPosition.y - 18}px`,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))",
              }}
            >
              {/* Pencil body */}
              <path
                d="M14 2 L18 6 L6 18 L2 18 L2 14 Z"
                fill={color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {/* Pencil tip */}
              <path
                d="M2 14 L6 18"
                stroke="white"
                strokeWidth="1.5"
              />
              {/* Pencil diagonal line */}
              <path
                d="M14 2 L2 14"
                stroke="white"
                strokeWidth="0.5"
                opacity="0.5"
              />
            </svg>
          </div>
        )}

        {/* Inline prompt box for image generation */}
        {!readOnly && promptBoxPosition && (
          <div
            className="retro-border absolute z-10 w-80 bg-background p-3 shadow-lg"
            style={{
              left: `${Math.min(promptBoxPosition.x, canvasRef.current ? canvasRef.current.offsetWidth - 330 : promptBoxPosition.x)}px`,
              top: `${Math.min(promptBoxPosition.y, canvasRef.current ? canvasRef.current.offsetHeight - 120 : promptBoxPosition.y)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form className="space-y-2" onSubmit={(event) => handleGenerateImage(event)}>
              <input
                type="text"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the image..."
                autoFocus
                disabled={isGeneratingImage}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
              />
              {imageError && <p className="text-xs text-destructive">{imageError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isGeneratingImage} className="flex-1">
                  {isGeneratingImage ? "Generating..." : "✓ Generate"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleCancelPendingImage}
                  disabled={isGeneratingImage}
                >
                  × Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Inline delete button for selected image */}
        {!readOnly && selectedImage && canvasRef.current && (
          <button
            onClick={handleDeleteSelectedImage}
            className="absolute z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-destructive bg-background text-destructive hover:bg-destructive hover:text-background transition"
            style={{
              left: `${((selectedImage.x + selectedImage.width) / canvasState.size.width) * canvasRef.current.offsetWidth}px`,
              top: `${(selectedImage.y / canvasState.size.height) * canvasRef.current.offsetHeight - 12}px`,
            }}
            title="Delete image"
          >
            ×
          </button>
        )}

        {/* Inline text editing overlay and toolbar */}
        {!readOnly && selectedTextBlock && canvasRef.current && (() => {
          console.log('[TEXT-DEBUG] Text overlay rendering for block:', selectedTextBlock.id)
          const { screenX, screenY } = getTextScreenPosition(selectedTextBlock, canvasRef.current, canvasState.size)
          const rect = canvasRef.current.getBoundingClientRect()
          const scaleX = rect.width / canvasState.size.width
          const scaleY = rect.height / canvasState.size.height

          return (
            <>
              {/* Compact icon toolbar */}
              <div
                className="retro-border absolute z-20 flex items-center gap-1 bg-background p-1.5 shadow-lg"
                style={{
                  left: `${Math.max(0, Math.min(screenX - rect.left, rect.width - 300))}px`,
                  top: `${Math.max(0, screenY - rect.top - 40)}px`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Font dropdown */}
                <select
                  value={selectedTextBlock.fontFamily}
                  onChange={(e) => updateSelectedTextBlock({ fontFamily: e.target.value as CanvasTextBlock["fontFamily"] })}
                  className="h-7 rounded border border-border bg-background px-2 text-xs"
                  title="Font"
                >
                  {TEXT_FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {/* Size dropdown */}
                <select
                  value={TEXT_SIZE_PRESETS.find((p) => p.value === selectedTextBlock.fontSize)?.value ?? 48}
                  onChange={(e) => {
                    const size = Number(e.target.value)
                    setTextFontSize(size)
                    updateSelectedTextBlock({ fontSize: size })
                  }}
                  className="h-7 rounded border border-border bg-background px-2 text-xs"
                  title="Size"
                >
                  {TEXT_SIZE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                {/* Alignment buttons */}
                <button
                  onClick={() => updateSelectedTextBlock({ align: "left" })}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded border border-border text-sm transition",
                    selectedTextBlock.align === "left" ? "bg-foreground text-background" : "bg-background hover:bg-muted"
                  )}
                  title="Align left"
                >
                  ⬅
                </button>
                <button
                  onClick={() => updateSelectedTextBlock({ align: "center" })}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded border border-border text-sm transition",
                    selectedTextBlock.align === "center" ? "bg-foreground text-background" : "bg-background hover:bg-muted"
                  )}
                  title="Align center"
                >
                  ⎯
                </button>
                <button
                  onClick={() => updateSelectedTextBlock({ align: "right" })}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded border border-border text-sm transition",
                    selectedTextBlock.align === "right" ? "bg-foreground text-background" : "bg-background hover:bg-muted"
                  )}
                  title="Align right"
                >
                  ➡
                </button>

                {/* Color swatches */}
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    onClick={() => {
                      setTextColor(swatch)
                      updateSelectedTextBlock({ color: swatch })
                    }}
                    className={cn(
                      "h-5 w-5 rounded-full border border-border transition",
                      selectedTextBlock.color === swatch ? "ring-2 ring-offset-1" : ""
                    )}
                    style={{ backgroundColor: swatch }}
                    title={`Color ${swatch}`}
                  />
                ))}

                {/* Delete button */}
                <button
                  onClick={handleDeleteSelectedText}
                  className="ml-1 flex h-7 w-7 items-center justify-center rounded border-2 border-destructive bg-background text-destructive hover:bg-destructive hover:text-background transition"
                  title="Delete text"
                >
                  ×
                </button>
              </div>

              {/* Text editing overlay */}
              <textarea
                value={selectedTextBlock.text}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 280)
                  updateSelectedTextBlock({ text: value })
                }}
                autoFocus
                className="absolute z-10 resize-none overflow-hidden border-2 border-dashed border-primary bg-transparent p-1 outline-none"
                style={{
                  left: `${screenX - rect.left - (selectedTextBlock.align === "center" ? 100 : selectedTextBlock.align === "right" ? 200 : 0)}px`,
                  top: `${screenY - rect.top}px`,
                  font: `${selectedTextBlock.fontSize * scaleY}px ${selectedTextBlock.fontFamily}`,
                  color: selectedTextBlock.color,
                  textAlign: selectedTextBlock.align,
                  width: selectedTextBlock.align === "center" ? "200px" : selectedTextBlock.align === "right" ? "200px" : "auto",
                  minWidth: "50px",
                  lineHeight: `${selectedTextBlock.fontSize * scaleY * LINE_HEIGHT_MULTIPLIER}px`,
                }}
                rows={selectedTextBlock.text.split("\n").length}
                onClick={(e) => e.stopPropagation()}
              />
            </>
          )
        })()}

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
