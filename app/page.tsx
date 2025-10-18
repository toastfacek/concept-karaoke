import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
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

        <div className="space-y-4 pt-8">
          <Button asChild size="lg" className="w-full text-lg">
            <Link href="/lobby/ABC123">Create Game</Link>
          </Button>

          <Button asChild size="lg" variant="outline" className="w-full text-lg bg-transparent">
            <Link href="/join">Join Game</Link>
          </Button>
        </div>

        <div className="retro-border mt-8 bg-muted p-6 text-left">
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
