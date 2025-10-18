import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { requireClientEnv, requireServerEnv } from "../env"
import type { Database } from "../database.types"

let adminClient: SupabaseClient<Database> | null = null

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (adminClient) {
    return adminClient
  }

  const url = requireClientEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireServerEnv("SUPABASE_SERVICE_ROLE_KEY")

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to create an admin client")
  }

  adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })

  return adminClient
}

export type AdminSupabaseClient = ReturnType<typeof getSupabaseAdminClient>
