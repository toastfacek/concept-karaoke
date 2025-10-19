import { z } from "zod"

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  REALTIME_SHARED_SECRET: z.string().optional(),
})

const optional = (value: string | undefined | null) => (value && value.length > 0 ? value : undefined)

const rawClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: optional(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optional(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
}

const rawServerEnv = {
  SUPABASE_SERVICE_ROLE_KEY: optional(process.env.SUPABASE_SERVICE_ROLE_KEY),
  STRIPE_SECRET_KEY: optional(process.env.STRIPE_SECRET_KEY),
  STRIPE_WEBHOOK_SECRET: optional(process.env.STRIPE_WEBHOOK_SECRET),
  OPENAI_API_KEY: optional(process.env.OPENAI_API_KEY),
  GEMINI_API_KEY: optional(process.env.GEMINI_API_KEY),
  REALTIME_SHARED_SECRET: optional(process.env.REALTIME_SHARED_SECRET),
}

export const env = {
  client: clientSchema.parse(rawClientEnv),
  server: serverSchema.parse(rawServerEnv),
}

export type ClientEnv = typeof env.client
export type ServerEnv = typeof env.server

export function requireClientEnv<K extends keyof ClientEnv>(key: K): ClientEnv[K] {
  const value = env.client[key]
  if (!value) {
    throw new Error(`Missing client environment variable: ${key as string}`)
  }

  return value
}

export function requireServerEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = env.server[key]
  if (!value) {
    throw new Error(`Missing server environment variable: ${key as string}`)
  }

  return value as NonNullable<ServerEnv[K]>
}
