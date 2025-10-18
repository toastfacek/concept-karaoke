"use client"

import { useEffect, useState } from "react"

interface TimerProps {
  endTime: Date
  onComplete?: () => void
  className?: string
}

export function Timer({ endTime, onComplete, className = "" }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime()
      const end = new Date(endTime).getTime()
      const remaining = Math.max(0, Math.floor((end - now) / 1000))

      setTimeLeft(remaining)

      if (remaining === 0 && onComplete) {
        onComplete()
      }
    }, 100)

    return () => clearInterval(interval)
  }, [endTime, onComplete])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  const isWarning = timeLeft <= 10 && timeLeft > 0
  const isExpired = timeLeft === 0

  return (
    <div
      className={`retro-border inline-flex items-center gap-2 px-6 py-3 font-mono text-2xl font-bold ${
        isExpired
          ? "bg-destructive text-destructive-foreground"
          : isWarning
            ? "animate-pulse bg-secondary text-secondary-foreground"
            : "bg-primary text-primary-foreground"
      } ${className}`}
    >
      <span className="text-sm uppercase tracking-wider">Time</span>
      <span className="tabular-nums">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  )
}
