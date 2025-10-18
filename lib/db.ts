const DEFAULT_CODE_LENGTH = 6
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export const TABLES = {
  gameRooms: "game_rooms",
  players: "players",
  campaignBriefs: "campaign_briefs",
  adLobs: "adlobs",
  votes: "votes",
} as const

export type TableName = (typeof TABLES)[keyof typeof TABLES]

export function generateRoomCode(length: number = DEFAULT_CODE_LENGTH): string {
  let code = ""

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * CODE_ALPHABET.length)
    code += CODE_ALPHABET[randomIndex]
  }

  return code
}
