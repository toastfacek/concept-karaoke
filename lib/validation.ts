import { z } from "zod"

const roomCode = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]{6}$/) // 6-character alphanumeric code

const displayName = z.string().trim().min(1).max(32)

export const createGameSchema = z.object({
  displayName,
  emoji: z.string().trim().min(1).max(8),
})

export const joinGameSchema = z.object({
  code: roomCode,
  displayName,
  emoji: z.string().trim().min(1).max(8),
})

export type CreateGameInput = z.infer<typeof createGameSchema>
export type JoinGameInput = z.infer<typeof joinGameSchema>
