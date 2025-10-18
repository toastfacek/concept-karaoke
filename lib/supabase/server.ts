import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireClientEnv } from "../env"
import type { Database } from "../database.types"

export async function getSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    requireClientEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireClientEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            cookieStore.set({
              name,
              value,
              ...(options ?? {}),
            })
          })
        },
      },
    },
  )
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>
