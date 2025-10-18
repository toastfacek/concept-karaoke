export interface Player {
  id: string
  roomId: string
  name: string
  emoji: string
  isReady: boolean
  isHost: boolean
  joinedAt: Date
}

export const GAME_STATUSES = ["lobby", "briefing", "creating", "pitching", "voting", "results"] as const
export type GameStatus = (typeof GAME_STATUSES)[number]

export const CREATION_PHASES = ["big_idea", "visual", "headline", "mantra"] as const
export type CreationPhase = (typeof CREATION_PHASES)[number]

export interface CampaignBrief {
  productName: string
  productCategory: string
  businessProblem: string
  targetAudience: string
  objective: string
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
  mantra: {
    text: string
    createdBy: string
  }
  assignedPitcher: string | null
  pitchOrder?: number | null
  pitchStartedAt?: Date | null
  pitchCompletedAt?: Date | null
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
}
