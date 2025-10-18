'use client'

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireClientEnv } from "../env"
import type { Database } from "../database.types"

let browserClient: SupabaseClient<Database> | null = null

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient
  }

  const supabaseUrl = requireClientEnv("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseAnonKey = requireClientEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  return browserClient
}

export type BrowserSupabaseClient = ReturnType<typeof getSupabaseBrowserClient>
