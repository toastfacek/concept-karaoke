"use client"

import { Bug } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Persistent bug report button that appears in bottom-right of screen
 * Opens Sentry feedback widget with session replay and screenshot capture
 */
export function FeedbackButton() {
  const handleClick = () => {
    // Access the Sentry feedback widget via global window object
    // The feedback integration is available after Sentry initialization
    if (typeof window !== "undefined" && (window as any).Sentry) {
      const sentryHub = (window as any).Sentry
      // Try to get the feedback integration and open dialog
      const client = sentryHub.getClient?.()
      if (client) {
        const integrations = client.getOptions?.()?.integrations || []
        const feedback = integrations.find((i: any) => i?.name === "Feedback")
        if (feedback && typeof feedback.openDialog === "function") {
          feedback.openDialog()
        }
      }
    }
  }

  // Only show in production
  if (process.env.NODE_ENV !== "production") {
    return null
  }

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      size="icon"
      className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg border-2 border-[#0047FF] bg-white hover:bg-[#0047FF] hover:text-white transition-colors"
      aria-label="Report a bug or suggestion"
      title="Report a bug or suggestion"
    >
      <Bug className="h-5 w-5" />
    </Button>
  )
}
