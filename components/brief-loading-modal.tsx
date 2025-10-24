"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"

interface BriefLoadingModalProps {
  isOpen: boolean
  category: string
  onComplete?: () => void
}

const LOADING_MESSAGES = [
  "Analyzing category",
  "Crafting brief",
  "Almost ready",
]

export function BriefLoadingModal({ isOpen, category, onComplete }: BriefLoadingModalProps) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      setMessageIndex(0)
      return
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 1500)

    return () => clearInterval(interval)
  }, [isOpen])

  return (
    <Dialog open={isOpen} modal>
      <DialogContent
        className="flex max-w-md flex-col items-center justify-center gap-8 border-4 border-primary bg-background p-12 text-center"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          Generating campaign brief for {category !== "All" ? category : "Random Category"}
        </DialogTitle>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold uppercase tracking-wide" aria-hidden="true">
            Generating Brief
          </h2>
          <p className="font-mono text-lg text-muted-foreground">
            {category !== "All" ? category : "Random Category"}
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <Spinner className="size-16" />
          <p className="font-mono text-sm font-medium uppercase tracking-wider transition-opacity duration-300">
            {LOADING_MESSAGES[messageIndex]}...
          </p>
        </div>

        <div className="flex gap-2">
          {LOADING_MESSAGES.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                index === messageIndex
                  ? "w-8 bg-primary"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
