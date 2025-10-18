"use client"

import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { sampleAdLobs, samplePlayers } from "@/lib/sample-data"
import { Trophy } from "lucide-react"

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string

  // Simulate vote results
  const adlobsWithVotes = sampleAdLobs.map((adlob, index) => ({
    ...adlob,
    voteCount: index === 0 ? 3 : 1, // First adlob wins
  }))

  const sortedAdLobs = [...adlobsWithVotes].sort((a, b) => b.voteCount - a.voteCount)
  const winner = sortedAdLobs[0]
  const winnerPitcher = samplePlayers.find((p) => p.id === winner.assignedPitcher)

  const getPitcherName = (pitcherId: string | null) => {
    return samplePlayers.find((p) => p.id === pitcherId)?.name || "Unknown"
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="retro-border bg-primary p-12 text-center text-primary-foreground">
          <Trophy className="mx-auto mb-4 size-16" />
          <h1 className="mb-2 text-5xl font-bold uppercase">Winner!</h1>
          <p className="text-3xl font-bold">
            <span className="text-4xl">{winnerPitcher?.emoji}</span> {winnerPitcher?.name}
          </p>
          <p className="mt-4 font-mono text-lg">
            {winner.voteCount} vote{winner.voteCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="retro-border bg-card p-8">
          <h2 className="mb-6 text-center text-2xl font-bold uppercase">Winning Campaign</h2>
          <div className="space-y-6">
            <div>
              <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Big Idea</p>
              <p className="text-2xl font-bold">{winner.bigIdea.text}</p>
            </div>

            <div className="retro-border aspect-video bg-white p-8">
              <p className="font-mono text-muted-foreground">[Winning Visual + Headline]</p>
            </div>

            <div>
              <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Campaign Mantra</p>
              <p className="text-lg">{winner.mantra.text}</p>
            </div>
          </div>
        </div>

        <div className="retro-border bg-card p-8">
          <h2 className="mb-6 text-center text-2xl font-bold uppercase">All Results</h2>
          <div className="space-y-4">
            {sortedAdLobs.map((adlob, index) => (
              <div key={adlob.id} className="retro-border flex items-center justify-between bg-muted p-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                  <div>
                    <p className="font-bold">{adlob.bigIdea.text}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      Pitched by {getPitcherName(adlob.assignedPitcher)}
                    </p>
                  </div>
                </div>
                <div className="retro-border bg-primary px-4 py-2 text-primary-foreground">
                  <p className="text-xl font-bold">{adlob.voteCount}</p>
                  <p className="font-mono text-xs">vote{adlob.voteCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button onClick={() => router.push("/")} size="lg" variant="outline">
            Back to Home
          </Button>
          <Button onClick={() => router.push(`/lobby/${roomId}`)} size="lg">
            Play Again
          </Button>
        </div>
      </div>
    </main>
  )
}
