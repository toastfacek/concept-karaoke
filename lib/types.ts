export interface Player {
  id: string
  roomId: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: Date
  seatIndex: number
}

export const GAME_STATUSES = ["lobby", "briefing", "creating", "presenting", "voting", "results"] as const
export type GameStatus = (typeof GAME_STATUSES)[number]

export const CREATION_PHASES = ["big_idea", "visual", "headline", "pitch"] as const
export type CreationPhase = (typeof CREATION_PHASES)[number]

export const PRODUCT_CATEGORIES = [
  "All",
  "Consumer Electronics",
  "Food & Beverage",
  "Fashion & Apparel",
  "Beauty & Cosmetics",
  "Automotive",
  "Sports & Fitness",
  "Home & Garden",
  "Travel & Hospitality",
  "Entertainment & Media",
  "Financial Services",
  "Healthcare & Wellness",
  "Technology & Software",
  "Education",
  "Real Estate",
  "Other",
] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const SPECIFIC_PRODUCT_CATEGORIES = PRODUCT_CATEGORIES.filter(cat => cat !== "All")

export const PHASE_DURATIONS = [30, 60, 90, 120] as const
export type PhaseDuration = (typeof PHASE_DURATIONS)[number]

export const BRIEF_STYLES = ["wacky", "realistic"] as const
export type BriefStyle = (typeof BRIEF_STYLES)[number]

export const WACKY_BRIEF_STYLES = [
  "absurd_constraints",
  "genre_mashups",
  "unnecessary_solutions",
  "conflicting_elements",
] as const
export type WackyBriefStyle = (typeof WACKY_BRIEF_STYLES)[number]

export interface CampaignBrief {
  productName: string // 2-4 words
  productCategory: string // From game settings
  coverImageUrl?: string // AI-generated product image
  briefContent: string // Prose brief (80-120 words) with markdown bold subheadings
}

export interface AdLob {
  id: string
  roomId: string
  briefId: string
  bigIdea: {
    text: string
    createdBy: string
  }
  visual: {
    canvasData: any
    imageUrls: string[]
    createdBy: string
  }
  headline: {
    canvasData: any
    createdBy: string
  }
  pitch: {
    text: string
    createdBy: string
  }
  assignedPresenter: string | null
  presentOrder?: number | null
  presentStartedAt?: Date | null
  presentCompletedAt?: Date | null
  voteCount: number
}

export interface GameRoom {
  id: string
  code: string
  status: GameStatus
  brief: CampaignBrief | null
  currentPhase: CreationPhase | null
  phaseStartTime: Date | null
  createdAt: Date
  hostId: string
  productCategory: string
  phaseDurationSeconds: number
  briefStyle: BriefStyle
  wackyBriefStyle: WackyBriefStyle
}
