"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { sampleAdLobs, samplePlayers } from "@/lib/sample-data"

export default function VotePage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string

  const [selectedAdLob, setSelectedAdLob] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)

  const adlobs = sampleAdLobs
  const currentUserId = samplePlayers[0].id

  const handleVote = () => {
    if (!selectedAdLob) return

    // TODO: Submit vote to API
    console.log("[v0] Voted for AdLob:", selectedAdLob)
    setHasVoted(true)

    // Simulate waiting for all votes
    setTimeout(() => {
      router.push(`/results/${roomId}`)
    }, 2000)
  }

  const getPitcherName = (pitcherId: string | null) => {
    return samplePlayers.find((p) => p.id === pitcherId)?.name || "Unknown"
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="retro-border bg-card p-6 text-center">
          <h1 className="text-4xl font-bold uppercase">Vote for Best Campaign</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {hasVoted ? "Waiting for other players..." : "Click a campaign to select, then vote"}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {adlobs.map((adlob) => {
            const canVote = adlob.assignedPitcher !== currentUserId
            const isSelected = selectedAdLob === adlob.id

            return (
              <button
                key={adlob.id}
                onClick={() => !hasVoted && canVote && setSelectedAdLob(adlob.id)}
                disabled={!canVote || hasVoted}
                className={`retro-border text-left transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : canVote && !hasVoted
                      ? "bg-card hover:bg-muted"
                      : "bg-muted opacity-50"
                } p-6`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-mono text-xs uppercase tracking-wider">
                    Pitched by {getPitcherName(adlob.assignedPitcher)}
                  </p>
                  {!canVote && (
                    <span className="rounded bg-accent px-2 py-1 text-xs font-bold text-accent-foreground">
                      YOUR PITCH
                    </span>
                  )}
                </div>

                <p className="mb-4 text-xl font-bold">{adlob.bigIdea.text}</p>

                <div className="retro-border aspect-video bg-white p-4">
                  <p className="font-mono text-xs text-muted-foreground">[Campaign Visual]</p>
                </div>

                <p className="mt-4 text-sm">{adlob.mantra.text}</p>
              </button>
            )
          })}
        </div>

        {!hasVoted && (
          <div className="flex justify-center">
            <Button onClick={handleVote} disabled={!selectedAdLob} size="lg" className="px-12">
              Cast Vote
            </Button>
          </div>
        )}

        {hasVoted && (
          <div className="retro-border bg-card p-6 text-center">
            <p className="font-mono text-lg">Vote submitted! Waiting for other players...</p>
          </div>
        )}
      </div>
    </main>
  )
}
