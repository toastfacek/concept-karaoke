"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { BriefEditor } from "@/components/brief-editor"
import { sampleBrief, samplePlayers } from "@/lib/sample-data"
import type { CampaignBrief } from "@/lib/types"
import { Button } from "@/components/ui/button"

export default function BriefPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string

  const [brief, setBrief] = useState<CampaignBrief>(sampleBrief)
  const [isLocked, setIsLocked] = useState(false)
  const [playersReady, setPlayersReady] = useState(0)
  const totalPlayers = samplePlayers.length

  const handleRegenerate = () => {
    // TODO: Call AI API to generate new brief
    console.log("[v0] Regenerate brief requested")
  }

  const handleLock = (newBrief: CampaignBrief) => {
    setBrief(newBrief)
    setIsLocked(true)
    setPlayersReady(playersReady + 1)
    // TODO: Update brief in database and mark player as ready
  }

  const handleStart = () => {
    // TODO: Call API to start creation phase
    router.push(`/create/${roomId}`)
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="retro-border bg-card p-6 text-center">
          <h1 className="text-4xl font-bold uppercase">Brief Generation</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Review and edit the campaign brief, then ready up
          </p>
        </div>

        <BriefEditor initialBrief={brief} onRegenerate={handleRegenerate} onLock={handleLock} isLocked={isLocked} />

        {isLocked && (
          <div className="retro-border bg-card p-8 text-center">
            <p className="mb-4 text-lg font-bold">
              Waiting for other players... ({playersReady}/{totalPlayers})
            </p>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: totalPlayers }).map((_, i) => (
                <div key={i} className={`size-4 rounded-full ${i < playersReady ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            {playersReady === totalPlayers && (
              <Button onClick={handleStart} size="lg" className="mt-6">
                Start Creation Phase
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
