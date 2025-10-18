"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { sampleAdLobs, samplePlayers } from "@/lib/sample-data"

export default function PitchPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string

  const [currentPitchIndex, setCurrentPitchIndex] = useState(0)
  const [showMantra, setShowMantra] = useState(true)
  const [showCampaign, setShowCampaign] = useState(false)

  const adlobs = sampleAdLobs
  const currentAdLob = adlobs[currentPitchIndex]
  const pitcher = samplePlayers.find((p) => p.id === currentAdLob.assignedPitcher)
  const isCurrentPitcher = pitcher?.id === samplePlayers[0].id // Assume first player is current user

  const handleRevealCampaign = () => {
    setShowMantra(false)
    setShowCampaign(true)
  }

  const handleEndPitch = () => {
    if (currentPitchIndex < adlobs.length - 1) {
      // Next pitch
      setCurrentPitchIndex(currentPitchIndex + 1)
      setShowMantra(true)
      setShowCampaign(false)
    } else {
      // All pitches done, go to voting
      router.push(`/vote/${roomId}`)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-5xl space-y-8">
        <div className="retro-border bg-card p-6 text-center">
          <p className="mb-2 font-mono text-sm uppercase tracking-wider text-muted-foreground">Up Next</p>
          <h1 className="text-4xl font-bold">
            <span className="text-5xl">{pitcher?.emoji}</span> {pitcher?.name}
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Pitch {currentPitchIndex + 1} of {adlobs.length}
          </p>
        </div>

        {showMantra && (
          <div className="retro-border bg-primary p-12 text-center text-primary-foreground">
            <p className="text-3xl font-bold leading-relaxed">{currentAdLob.mantra.text}</p>
            {isCurrentPitcher && (
              <Button onClick={handleRevealCampaign} size="lg" variant="secondary" className="mt-8">
                Reveal Campaign
              </Button>
            )}
          </div>
        )}

        {showCampaign && (
          <div className="retro-border bg-card p-8">
            <div className="space-y-6">
              <div>
                <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Big Idea</p>
                <p className="text-2xl font-bold">{currentAdLob.bigIdea.text}</p>
              </div>

              <div className="retro-border aspect-video bg-white p-8">
                <p className="font-mono text-muted-foreground">[Visual + Headline Canvas]</p>
              </div>

              <div>
                <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Campaign Mantra</p>
                <p className="text-lg">{currentAdLob.mantra.text}</p>
              </div>
            </div>

            {isCurrentPitcher && (
              <Button onClick={handleEndPitch} size="lg" className="mt-8 w-full">
                End Pitch
              </Button>
            )}
          </div>
        )}

        {!isCurrentPitcher && (
          <div className="retro-border bg-muted p-6 text-center">
            <p className="font-mono text-sm text-muted-foreground">Watching {pitcher?.name}'s pitch...</p>
          </div>
        )}
      </div>
    </main>
  )
}
