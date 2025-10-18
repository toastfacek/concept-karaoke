"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  // Characters
  CreativeIcon,
  StrategistIcon,
  ClientIcon,
  // Ideas
  LightbulbIcon,
  BrainstormIcon,
  SparkleIcon,
  // Campaign & Media
  MegaphoneIcon,
  BillboardIcon,
  TVIcon,
  SocialMediaIcon,
  // Tools
  PencilIcon,
  CameraIcon,
  PaintbrushIcon,
  ClapperboardIcon,
  // Game Mechanics
  TimerIcon,
  TrophyIcon,
  StarIcon,
  ThumbsUpIcon,
  VoteIcon,
  // Objects
  CoffeeIcon,
  NotebookIcon,
  StickyNoteIcon,
  BriefcaseIcon,
  // Reactions
  HappyFaceIcon,
  ThinkingFaceIcon,
  ExcitedFaceIcon,
  CollaborateIcon,
  PresentIcon,
} from "@/components/game-icons"

export function DesignSystemShowcase() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Big Type Ogilvy Style */}
      <section className="relative overflow-hidden border-b-4 border-foreground bg-primary px-6 py-20 md:py-32">
        <div className="scanlines absolute inset-0" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mb-4 inline-block">
            <Badge className="retro-border bg-accent text-accent-foreground font-mono text-xs">
              DESIGN SYSTEM v1.0
            </Badge>
          </div>
          <h1 className="mb-6 text-primary-foreground">
            THE BIG IDEA
            <br />
            <span className="highlight bg-accent text-foreground">STARTS HERE</span>
          </h1>
          <p className="max-w-2xl text-xl font-bold text-primary-foreground md:text-2xl">
            A collaborative game for advertising creatives. Create campaigns on the fly with the aesthetic of classic
            Ogilvy meets cassette futurism.
          </p>
        </div>
      </section>

      {/* Color Palette */}
      <section className="border-b-4 border-foreground px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12">COLOR SYSTEM</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="retro-border overflow-hidden bg-primary p-0">
              <div className="aspect-square bg-primary" />
              <div className="p-6">
                <h3 className="mb-2 font-mono text-sm text-primary-foreground">PRIMARY</h3>
                <p className="font-mono text-xs text-primary-foreground">#0047FF</p>
                <p className="mt-2 text-sm text-primary-foreground">Electric Blue - The cassette futurism anchor</p>
              </div>
            </Card>

            <Card className="retro-border overflow-hidden bg-secondary p-0">
              <div className="aspect-square bg-secondary" />
              <div className="p-6">
                <h3 className="mb-2 font-mono text-sm text-secondary-foreground">SECONDARY</h3>
                <p className="font-mono text-xs text-secondary-foreground">#FF006E</p>
                <p className="mt-2 text-sm text-secondary-foreground">Hot Pink - Retro energy accent</p>
              </div>
            </Card>

            <Card className="retro-border overflow-hidden bg-accent p-0">
              <div className="aspect-square bg-accent" />
              <div className="p-6">
                <h3 className="mb-2 font-mono text-sm text-accent-foreground">ACCENT</h3>
                <p className="font-mono text-xs text-accent-foreground">#FFD60A</p>
                <p className="mt-2 text-sm text-accent-foreground">Highlight Yellow - Marker emphasis</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="border-b-4 border-foreground px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12">TYPOGRAPHY</h2>
          <div className="space-y-8">
            <div>
              <p className="mb-4 font-mono text-sm text-muted-foreground">DISPLAY / SPACE GROTESK BOLD</p>
              <h1 className="text-foreground">THE BIG HEADLINE</h1>
            </div>
            <div>
              <p className="mb-4 font-mono text-sm text-muted-foreground">HEADING / SPACE GROTESK BOLD</p>
              <h2 className="text-foreground">Secondary Headline Style</h2>
            </div>
            <div>
              <p className="mb-4 font-mono text-sm text-muted-foreground">SUBHEADING / SPACE GROTESK BOLD</p>
              <h3 className="text-foreground">Tertiary Headline Style</h3>
            </div>
            <div>
              <p className="mb-4 font-mono text-sm text-muted-foreground">BODY / SPACE GROTESK REGULAR</p>
              <p className="max-w-3xl text-lg leading-relaxed">
                Body copy should be clear, readable, and maintain the professional yet playful tone of classic
                advertising. Every word counts. Make it memorable. Make it sell.
              </p>
            </div>
            <div>
              <p className="mb-4 font-mono text-sm text-muted-foreground">MONO / IBM PLEX MONO REGULAR</p>
              <p className="font-mono text-lg">CAMPAIGN_ID: 001 | STATUS: ACTIVE | PLAYERS: 04</p>
            </div>
          </div>
        </div>
      </section>

      {/* Components */}
      <section className="border-b-4 border-foreground px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12">COMPONENTS</h2>

          {/* Buttons */}
          <div className="mb-16">
            <h3 className="mb-6">Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <Button className="retro-button bg-primary text-primary-foreground hover:bg-primary">
                PRIMARY ACTION
              </Button>
              <Button className="retro-button bg-secondary text-secondary-foreground hover:bg-secondary">
                SECONDARY ACTION
              </Button>
              <Button className="retro-button bg-accent text-accent-foreground hover:bg-accent">ACCENT ACTION</Button>
              <Button
                variant="outline"
                className="retro-button border-foreground bg-background text-foreground hover:bg-foreground hover:text-background"
              >
                OUTLINE
              </Button>
            </div>
          </div>

          {/* Cards */}
          <div className="mb-16">
            <h3 className="mb-6">Cards</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="retro-border p-6">
                <div className="mb-4">
                  <Badge className="bg-primary text-primary-foreground font-mono text-xs">CAMPAIGN</Badge>
                </div>
                <h3 className="mb-2">Campaign Brief #001</h3>
                <p className="mb-4 text-muted-foreground">
                  Create a revolutionary campaign for a new product launch. Think big. Think bold.
                </p>
                <div className="flex items-center gap-4 font-mono text-sm">
                  <span className="mono-numbers">04 PLAYERS</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="mono-numbers">12:45 LEFT</span>
                </div>
              </Card>

              <Card className="retro-border cassette-lines relative overflow-hidden p-6">
                <div className="relative z-10">
                  <div className="mb-4">
                    <Badge className="bg-secondary text-secondary-foreground font-mono text-xs">ACTIVE</Badge>
                  </div>
                  <h3 className="mb-2">Cassette Style Card</h3>
                  <p className="mb-4 text-muted-foreground">With retro tape lines for that authentic analog feel.</p>
                  <div className="stamp">APPROVED</div>
                </div>
              </Card>
            </div>
          </div>

          {/* Form Elements */}
          <div className="mb-16">
            <h3 className="mb-6">Form Elements</h3>
            <div className="max-w-md space-y-4">
              <div>
                <label className="mb-2 block font-mono text-sm font-bold uppercase">Campaign Name</label>
                <Input placeholder="Enter your big idea..." className="border-2 border-foreground focus:ring-primary" />
              </div>
              <div>
                <label className="mb-2 block font-mono text-sm font-bold uppercase">Target Audience</label>
                <Input placeholder="Who are we talking to?" className="border-2 border-foreground focus:ring-primary" />
              </div>
            </div>
          </div>

          {/* Special Effects */}
          <div>
            <h3 className="mb-6">Special Effects</h3>
            <div className="space-y-8">
              <div>
                <p className="mb-2 font-mono text-sm text-muted-foreground">HIGHLIGHT EFFECT</p>
                <p className="text-2xl font-bold">
                  This is how we <span className="highlight">emphasize key points</span> in our copy.
                </p>
              </div>

              <div>
                <p className="mb-2 font-mono text-sm text-muted-foreground">PULL QUOTE</p>
                <blockquote className="pull-quote">
                  "The consumer isn't a moron; she is your wife. You insult her intelligence if you assume that a mere
                  slogan and a few vapid adjectives will persuade her to buy anything."
                </blockquote>
                <p className="font-mono text-sm text-muted-foreground">— David Ogilvy</p>
              </div>

              <div>
                <p className="mb-2 font-mono text-sm text-muted-foreground">STAMP EFFECT</p>
                <div className="flex flex-wrap gap-4">
                  <div className="stamp">APPROVED</div>
                  <div className="stamp text-secondary">URGENT</div>
                  <div className="stamp text-primary">PRIORITY</div>
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-sm text-muted-foreground">SCANLINES EFFECT</p>
                <Card className="scanlines retro-border relative bg-primary p-8">
                  <p className="relative z-10 text-xl font-bold text-primary-foreground">
                    Retro CRT monitor aesthetic with subtle scanlines
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Game Icons */}
      <section className="border-b-4 border-foreground px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12">GAME ICONS</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Cartoony, expressive icons for the collaborative advertising game
          </p>

          {/* Player Characters */}
          <div className="mb-12">
            <h3 className="mb-6 text-primary">Player Characters</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <CreativeIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Creative</h4>
                <p className="font-mono text-xs text-muted-foreground">Wild ideas, big energy</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <StrategistIcon className="mb-4 text-secondary" size={64} />
                <h4 className="mb-2 font-bold">Strategist</h4>
                <p className="font-mono text-xs text-muted-foreground">Thinks before acting</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <ClientIcon className="mb-4 text-accent" size={64} />
                <h4 className="mb-2 font-bold">Client</h4>
                <p className="font-mono text-xs text-muted-foreground">Needs convincing</p>
              </Card>
            </div>
          </div>

          {/* Ideas & Creativity */}
          <div className="mb-12">
            <h3 className="mb-6 text-secondary">Ideas & Creativity</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <LightbulbIcon className="mb-4 text-accent" size={64} />
                <h4 className="mb-2 font-bold">Lightbulb</h4>
                <p className="font-mono text-xs text-muted-foreground">Big idea moment</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <BrainstormIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Brainstorm</h4>
                <p className="font-mono text-xs text-muted-foreground">Lightning strikes</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <SparkleIcon className="mb-4 text-secondary" size={64} />
                <h4 className="mb-2 font-bold">Sparkle</h4>
                <p className="font-mono text-xs text-muted-foreground">Magic happens</p>
              </Card>
            </div>
          </div>

          {/* Campaign & Media */}
          <div className="mb-12">
            <h3 className="mb-6 text-accent">Campaign & Media</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <MegaphoneIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Megaphone</h4>
                <p className="font-mono text-xs text-muted-foreground">Amplify message</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <BillboardIcon className="mb-4 text-secondary" size={64} />
                <h4 className="mb-2 font-bold">Billboard</h4>
                <p className="font-mono text-xs text-muted-foreground">Out of home</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <TVIcon className="mb-4 text-accent" size={64} />
                <h4 className="mb-2 font-bold">TV</h4>
                <p className="font-mono text-xs text-muted-foreground">Broadcast media</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <SocialMediaIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Social Media</h4>
                <p className="font-mono text-xs text-muted-foreground">Digital reach</p>
              </Card>
            </div>
          </div>

          {/* Creative Tools */}
          <div className="mb-12">
            <h3 className="mb-6 text-primary">Creative Tools</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <PencilIcon className="mb-4 text-secondary" size={64} />
                <h4 className="mb-2 font-bold">Pencil</h4>
                <p className="font-mono text-xs text-muted-foreground">Write copy</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <CameraIcon className="mb-4 text-accent" size={64} />
                <h4 className="mb-2 font-bold">Camera</h4>
                <p className="font-mono text-xs text-muted-foreground">Capture visuals</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <PaintbrushIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Paintbrush</h4>
                <p className="font-mono text-xs text-muted-foreground">Create art</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <ClapperboardIcon className="mb-4 text-secondary" size={64} />
                <h4 className="mb-2 font-bold">Clapperboard</h4>
                <p className="font-mono text-xs text-muted-foreground">Shoot video</p>
              </Card>
            </div>
          </div>

          {/* Game Mechanics */}
          <div className="mb-12">
            <h3 className="mb-6 text-secondary">Game Mechanics</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <TimerIcon className="mb-4 text-accent" size={64} />
                <h4 className="mb-2 font-bold">Timer</h4>
                <p className="font-mono text-xs text-muted-foreground">Time pressure</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <TrophyIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Trophy</h4>
                <p className="font-mono text-xs text-muted-foreground">Win the pitch</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <StarIcon className="mb-4 text-secondary" size={64} />
                <h4 className="mb-2 font-bold">Star</h4>
                <p className="font-mono text-xs text-muted-foreground">Rate ideas</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <ThumbsUpIcon className="mb-4 text-accent" size={64} />
                <h4 className="mb-2 font-bold">Thumbs Up</h4>
                <p className="font-mono text-xs text-muted-foreground">Approve concept</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <VoteIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Vote</h4>
                <p className="font-mono text-xs text-muted-foreground">Cast ballot</p>
              </Card>
            </div>
          </div>

          {/* Objects & Items */}
          <div className="mb-12">
            <h3 className="mb-6 text-accent">Objects & Items</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <CoffeeIcon className="mb-4 text-secondary" size={64} />
                <h4 className="mb-2 font-bold">Coffee</h4>
                <p className="font-mono text-xs text-muted-foreground">Fuel creativity</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <NotebookIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Notebook</h4>
                <p className="font-mono text-xs text-muted-foreground">Jot ideas</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <StickyNoteIcon className="mb-4 text-accent" size={64} />
                <h4 className="mb-2 font-bold">Sticky Note</h4>
                <p className="font-mono text-xs text-muted-foreground">Quick thoughts</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <BriefcaseIcon className="mb-4 text-secondary" size={64} />
                <h4 className="mb-2 font-bold">Briefcase</h4>
                <p className="font-mono text-xs text-muted-foreground">Business ready</p>
              </Card>
            </div>
          </div>

          {/* Reactions & Actions */}
          <div className="mb-12">
            <h3 className="mb-6 text-primary">Reactions & Actions</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <HappyFaceIcon className="mb-4 text-accent" size={64} />
                <h4 className="mb-2 font-bold">Happy</h4>
                <p className="font-mono text-xs text-muted-foreground">Love it!</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <ThinkingFaceIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Thinking</h4>
                <p className="font-mono text-xs text-muted-foreground">Hmm...</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <ExcitedFaceIcon className="mb-4 text-secondary" size={64} />
                <h4 className="mb-2 font-bold">Excited</h4>
                <p className="font-mono text-xs text-muted-foreground">Amazing!</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <CollaborateIcon className="mb-4 text-accent" size={64} />
                <h4 className="mb-2 font-bold">Collaborate</h4>
                <p className="font-mono text-xs text-muted-foreground">Team up</p>
              </Card>
              <Card className="retro-border flex flex-col items-center p-6 text-center">
                <PresentIcon className="mb-4 text-primary" size={64} />
                <h4 className="mb-2 font-bold">Present</h4>
                <p className="font-mono text-xs text-muted-foreground">Pitch it</p>
              </Card>
            </div>
          </div>

          {/* Icon Size Variations */}
          <div className="mt-12">
            <h3 className="mb-6">Size Variations</h3>
            <div className="flex flex-wrap items-end gap-8">
              <div className="text-center">
                <LightbulbIcon className="mb-2 text-accent" size={24} />
                <p className="font-mono text-xs">24px</p>
              </div>
              <div className="text-center">
                <LightbulbIcon className="mb-2 text-accent" size={32} />
                <p className="font-mono text-xs">32px</p>
              </div>
              <div className="text-center">
                <LightbulbIcon className="mb-2 text-accent" size={48} />
                <p className="font-mono text-xs">48px</p>
              </div>
              <div className="text-center">
                <LightbulbIcon className="mb-2 text-accent" size={64} />
                <p className="font-mono text-xs">64px</p>
              </div>
              <div className="text-center">
                <LightbulbIcon className="mb-2 text-accent" size={96} />
                <p className="font-mono text-xs">96px</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid System */}
      <section className="border-b-4 border-foreground px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12">GRID SYSTEM</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Classic 12-column grid inspired by print advertising layouts
          </p>
          <div className="ad-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="retro-border flex aspect-square items-center justify-center bg-muted">
                <span className="font-mono text-sm font-bold">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Design Principles */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12">DESIGN PRINCIPLES</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <h3 className="mb-4 text-primary">01. BIG & BOLD</h3>
              <p className="text-muted-foreground">
                Headlines should dominate. Make every word count. Channel Ogilvy's confidence in typography.
              </p>
            </div>
            <div>
              <h3 className="mb-4 text-secondary">02. RETRO FUTURE</h3>
              <p className="text-muted-foreground">
                Blend analog warmth with digital precision. Cassette tapes meet modern interfaces.
              </p>
            </div>
            <div>
              <h3 className="mb-4 text-accent">03. SHARP EDGES</h3>
              <p className="text-muted-foreground">
                Geometric, confident, decisive. No soft corners. Every element has presence and purpose.
              </p>
            </div>
            <div>
              <h3 className="mb-4 text-primary">04. HIGH CONTRAST</h3>
              <p className="text-muted-foreground">
                Black and white foundation with electric color accents. Readable, accessible, impactful.
              </p>
            </div>
            <div>
              <h3 className="mb-4 text-secondary">05. GRID DISCIPLINE</h3>
              <p className="text-muted-foreground">
                Respect the grid like a print layout. Structure creates freedom for creativity.
              </p>
            </div>
            <div>
              <h3 className="mb-4 text-accent">06. PLAYFUL SERIOUS</h3>
              <p className="text-muted-foreground">
                Professional but never boring. Retro but not nostalgic. Creative but strategic.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
