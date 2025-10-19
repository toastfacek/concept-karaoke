import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LightbulbIcon, MegaphoneIcon, TrophyIcon, TimerIcon } from "@/components/game-icons"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10 px-6 py-20">
        <div className="cassette-lines pointer-events-none absolute inset-0 opacity-30" />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-block">
            <div className="retro-border bg-accent px-6 py-2">
              <p className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
                The Collaborative Ad Concept Game
              </p>
            </div>
          </div>

          <h1 className="mb-8 text-7xl font-bold uppercase leading-none tracking-tighter md:text-9xl">
            Bad
            <span className="text-primary">Lobs</span>
          </h1>

          <p className="mx-auto mb-12 max-w-2xl text-balance text-xl leading-relaxed text-muted-foreground md:text-2xl">
            Create brilliant ad campaigns with your team—without seeing what anyone else is doing. Pitch blind. Vote
            honest. Laugh hard.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="retro-border min-w-[200px] text-lg font-bold uppercase">
              <Link href="/create">Create Game</Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="retro-border min-w-[200px] border-2 border-foreground bg-transparent text-lg font-bold uppercase hover:bg-foreground hover:text-background"
            >
              <Link href="/join">Join Game</Link>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="retro-border bg-card p-4">
              <p className="text-3xl font-bold text-primary">3-8</p>
              <p className="font-mono text-xs uppercase text-muted-foreground">Players</p>
            </div>
            <div className="retro-border bg-card p-4">
              <p className="text-3xl font-bold text-secondary">60s</p>
              <p className="font-mono text-xs uppercase text-muted-foreground">Per Round</p>
            </div>
            <div className="retro-border bg-card p-4">
              <p className="text-3xl font-bold text-accent">4</p>
              <p className="font-mono text-xs uppercase text-muted-foreground">Rounds</p>
            </div>
            <div className="retro-border bg-card p-4">
              <p className="text-3xl font-bold text-primary">∞</p>
              <p className="font-mono text-xs uppercase text-muted-foreground">Laughs</p>
            </div>
          </div>
        </div>
      </section>

      {/* How to Play Section */}
      <section className="bg-muted px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-5xl font-bold uppercase tracking-tight md:text-6xl">How to Play</h2>
            <p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground">
              Four rounds. One campaign. Zero visibility. Maximum chaos.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="retro-border bg-background p-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <LightbulbIcon className="text-primary" size={32} />
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-4xl font-bold text-primary">1</span>
                <h3 className="text-xl font-bold uppercase">Big Idea</h3>
              </div>
              <p className="font-mono text-sm leading-relaxed text-muted-foreground">
                Write the core concept for your campaign. What's the big creative insight?
              </p>
            </div>

            {/* Step 2 */}
            <div className="retro-border bg-background p-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10">
                <svg
                  className="text-secondary"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-4xl font-bold text-secondary">2</span>
                <h3 className="text-xl font-bold uppercase">Visual</h3>
              </div>
              <p className="font-mono text-sm leading-relaxed text-muted-foreground">
                Draw or describe the key visual. You can't see the Big Idea—just wing it!
              </p>
            </div>

            {/* Step 3 */}
            <div className="retro-border bg-background p-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <MegaphoneIcon className="text-accent" size={32} />
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-4xl font-bold text-accent">3</span>
                <h3 className="text-xl font-bold uppercase">Headline</h3>
              </div>
              <p className="font-mono text-sm leading-relaxed text-muted-foreground">
                Craft the perfect headline. Still can't see what came before. Trust the process!
              </p>
            </div>

            {/* Step 4 */}
            <div className="retro-border bg-background p-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <TimerIcon className="text-primary" size={32} />
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-4xl font-bold text-primary">4</span>
                <h3 className="text-xl font-bold uppercase">Pitch</h3>
              </div>
              <p className="font-mono text-sm leading-relaxed text-muted-foreground">
                Write the elevator pitch. The tagline. The closer. Make it sing!
              </p>
            </div>
          </div>

          <div className="retro-border mt-12 bg-gradient-to-br from-secondary/20 to-primary/20 p-8 text-center">
            <TrophyIcon className="mx-auto mb-4 text-accent" size={64} />
            <h3 className="mb-4 text-3xl font-bold uppercase">The Twist</h3>
            <p className="mx-auto max-w-3xl text-balance text-lg leading-relaxed">
              After all rounds are complete, you'll pitch your campaign to the group—
              <span className="font-bold text-primary"> but you can only see the final writeup</span>. Everyone votes on
              the best pitch, and the winner is crowned Creative Director of the Year!
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-foreground px-6 py-20 text-background">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-5xl font-bold uppercase tracking-tight md:text-6xl">Ready to Create?</h2>
          <p className="mb-8 text-balance text-xl leading-relaxed opacity-90">
            Gather your team, trust the chaos, and make something brilliant (or hilariously terrible).
          </p>
          <Button
            asChild
            size="lg"
            className="retro-border min-w-[250px] bg-accent text-lg font-bold uppercase text-foreground hover:bg-accent/90"
          >
            <Link href="/create">Start Playing Now</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
