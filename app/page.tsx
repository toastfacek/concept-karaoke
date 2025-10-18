"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { savePlayer } from "@/lib/player-storage"
import { emojis } from "@/lib/sample-data"

const EMOJI_CHOICES = emojis.slice(0, 16)

export default function Home() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_CHOICES[0] ?? "🎨")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateGame = async () => {
    if (!playerName) return

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch("/api/games/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName,
          emoji: selectedEmoji,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Failed to create game. Please try again.")
        return
      }

      savePlayer(payload.room.code, {
        id: payload.player.id,
        name: payload.player.name,
        emoji: payload.player.emoji,
        isHost: payload.player.isHost,
      })

      router.push(`/lobby/${payload.room.code}`)
    } catch (createError) {
      console.error(createError)
      setError("Something went wrong while creating the game.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="retro-border w-full max-w-2xl space-y-8 bg-card p-12 text-center">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold uppercase leading-tight tracking-tight">
            Concept
            <br />
            Karaoke
          </h1>
          <p className="font-mono text-lg text-muted-foreground">The Exquisite Corpse Ad Game</p>
        </div>

        <div className="space-y-6 pt-8 text-left">
          <h2 className="text-2xl font-bold uppercase">Create a Lobby</h2>
          <p className="font-mono text-sm text-muted-foreground">
            No accounts required—pick a name and emoji, then invite friends with the code you&apos;ll get instantly.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playerName">Display Name</Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="What should we call you?"
              />
            </div>

            <div className="space-y-2">
              <Label>Select Emoji</Label>
              <div className="retro-border grid grid-cols-8 gap-2 bg-muted p-4">
                {EMOJI_CHOICES.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`text-2xl transition-transform hover:scale-125 ${
                      selectedEmoji === emoji ? "scale-125" : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="text-center font-mono text-sm text-muted-foreground">
                Selected: <span className="text-2xl">{selectedEmoji}</span>
              </p>
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <Button onClick={handleCreateGame} size="lg" className="w-full text-lg" disabled={!playerName || isCreating}>
              {isCreating ? "Creating Lobby..." : "Create Game"}
            </Button>

            <Button asChild size="lg" variant="outline" className="w-full text-lg bg-transparent">
              <Link href="/join">Join With a Code</Link>
            </Button>
          </div>
        </div>

        <div className="retro-border bg-muted p-6 text-left">
          <h3 className="mb-3 font-bold uppercase">How to Play</h3>
          <ul className="space-y-2 font-mono text-sm text-muted-foreground">
            <li>• Create campaigns collaboratively</li>
            <li>• 60 seconds per round</li>
            <li>• Pitch without seeing the full campaign</li>
            <li>• Vote for the best pitch</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
