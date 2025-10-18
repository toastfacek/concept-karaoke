"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { emojis } from "@/lib/sample-data"

export default function JoinPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState(emojis[0])

  const handleJoin = () => {
    // TODO: Call API to join game with code
    // For now, just navigate to lobby
    if (code && name) {
      router.push(`/lobby/${code.toUpperCase()}`)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="retro-border w-full max-w-md space-y-8 bg-card p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold uppercase">Join Game</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">Enter the 6-character code</p>
        </div>

        <div className="space-y-6">
          <div>
            <Label htmlFor="code">Game Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="text-center text-2xl font-bold uppercase tracking-widest"
            />
          </div>

          <div>
            <Label htmlFor="name">Your Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
          </div>

          <div>
            <Label>Choose Your Emoji</Label>
            <div className="retro-border mt-2 grid grid-cols-8 gap-2 bg-muted p-4">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`text-2xl transition-transform hover:scale-125 ${
                    selectedEmoji === emoji ? "scale-125" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <p className="mt-2 text-center font-mono text-sm text-muted-foreground">
              Selected: <span className="text-2xl">{selectedEmoji}</span>
            </p>
          </div>

          <Button onClick={handleJoin} disabled={!code || !name} size="lg" className="w-full">
            Join Game
          </Button>

          <Button variant="ghost" onClick={() => router.push("/")} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    </main>
  )
}
