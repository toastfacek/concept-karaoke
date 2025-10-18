"use client"

import { useState } from "react"
import { Button } from "./ui/button"

interface CanvasProps {
  initialData?: any
  onSave?: (data: any) => void
  readOnly?: boolean
  className?: string
}

export function Canvas({ initialData, onSave, readOnly = false, className = "" }: CanvasProps) {
  const [canvasData, setCanvasData] = useState(initialData || {})

  // TODO: Integrate with Excalidraw or tldraw library
  // For now, this is a placeholder

  return (
    <div className={`retro-border flex flex-col bg-background ${className}`}>
      <div className="flex items-center justify-between border-b-4 border-foreground bg-muted p-4">
        <div className="flex gap-2">
          {!readOnly && (
            <>
              <Button size="sm" variant="outline" disabled>
                Pen
              </Button>
              <Button size="sm" variant="outline" disabled>
                Shapes
              </Button>
              <Button size="sm" variant="outline" disabled>
                Text
              </Button>
              <Button size="sm" variant="outline" disabled>
                Eraser
              </Button>
            </>
          )}
        </div>
        {!readOnly && (
          <Button size="sm" onClick={() => onSave?.(canvasData)}>
            Save
          </Button>
        )}
      </div>
      <div className="flex aspect-video flex-1 items-center justify-center bg-white p-8">
        <p className="font-mono text-muted-foreground">
          {readOnly ? "[Canvas View - Read Only]" : "[Canvas Editor - TODO: Integrate drawing library]"}
        </p>
      </div>
    </div>
  )
}
