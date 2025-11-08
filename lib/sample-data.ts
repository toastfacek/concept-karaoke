import type { Player, CampaignBrief, AdLob, GameRoom } from "./types"

export const samplePlayers: Player[] = [
  {
    id: "1",
    roomId: "ABC123",
    name: "Alex",
    emoji: "🎨",
    isReady: true,
    isHost: true,
    joinedAt: new Date(),
  },
  {
    id: "2",
    roomId: "ABC123",
    name: "Jordan",
    emoji: "✏️",
    isReady: true,
    isHost: false,
    joinedAt: new Date(),
  },
  {
    id: "3",
    roomId: "ABC123",
    name: "Sam",
    emoji: "💡",
    isReady: false,
    isHost: false,
    joinedAt: new Date(),
  },
  {
    id: "4",
    roomId: "ABC123",
    name: "Taylor",
    emoji: "🚀",
    isReady: true,
    isHost: false,
    joinedAt: new Date(),
  },
]

export const sampleBrief: CampaignBrief = {
  productName: "SnoozeButton Pro",
  productCategory: "Smart Home Device",
  businessProblem:
    "People struggle to wake up on time and often hit snooze repeatedly, leading to rushed mornings and poor sleep habits.",
  targetAudience: "Busy professionals aged 25-40 who value productivity and better sleep",
  objective:
    "Position SnoozeButton Pro as the ultimate solution for morning routines, emphasizing its smart features that gradually wake users naturally.",
}

export const sampleAdLobs: AdLob[] = [
  {
    id: "adlob1",
    roomId: "ABC123",
    briefId: "brief1",
    bigIdea: {
      text: "Wake up to your best self - not your worst alarm",
      createdBy: "1",
    },
    visual: {
      canvasData: {},
      imageUrls: [],
      createdBy: "2",
    },
    headline: {
      canvasData: {},
      createdBy: "3",
    },
    pitch: {
      text: "SnoozeButton Pro doesn't just wake you up—it transforms your mornings. Using AI-powered sleep tracking and gradual light therapy, it ensures you rise naturally, refreshed, and ready to conquer the day. Say goodbye to jarring alarms and hello to your most productive self.",
      createdBy: "4",
    },
    assignedPresenter: "2",
    voteCount: 0,
  },
]

export const sampleGameRoom: GameRoom = {
  id: "game1",
  code: "ABC123",
  status: "lobby",
  brief: null,
  currentPhase: null,
  phaseStartTime: null,
  createdAt: new Date(),
  hostId: "1",
  productCategory: "Consumer Electronics",
  phaseDurationSeconds: 60,
  briefStyle: "wacky",
}

export const emojis = [
  "🎨",
  "✏️",
  "💡",
  "🚀",
  "🎯",
  "🎪",
  "🎭",
  "🎬",
  "📱",
  "💻",
  "🎮",
  "🎲",
  "🎸",
  "🎹",
  "🎺",
  "🎻",
  "⚡",
  "🔥",
  "💫",
  "⭐",
  "🌟",
  "✨",
  "🎉",
  "🎊",
]
