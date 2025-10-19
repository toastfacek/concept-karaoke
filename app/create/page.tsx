"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { emojis } from "@/lib/sample-data"
import { savePlayer } from "@/lib/player-storage"

export default function CreateGamePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState(emojis[0])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateGame = async () => {
    if (!name) return

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch("/api/games/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: name,
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
      console.error("Failed to create game", createError)
      setError("Something went wrong while creating the game.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="retro-border w-full max-w-md space-y-8 bg-card p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold uppercase">Create Game</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Pick your name and emoji. We’ll handle the lobby code.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              maxLength={50}
            />
          </div>

          <div>
            <Label>Choose Your Emoji</Label>
            <div className="retro-border mt-2 grid grid-cols-8 gap-2 bg-muted p-4">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`text-2xl transition-transform hover:scale-125 ${selectedEmoji === emoji ? "scale-125" : ""}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <p className="mt-2 text-center font-mono text-sm text-muted-foreground">
              Selected: <span className="text-2xl">{selectedEmoji}</span>
            </p>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button onClick={handleCreateGame} disabled={!name || isCreating} size="lg" className="w-full">
            {isCreating ? "Creating..." : "Spin Up Lobby"}
          </Button>

          <Button variant="ghost" onClick={() => router.push("/")} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    </main>
  )
}
