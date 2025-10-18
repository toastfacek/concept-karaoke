import type { User } from "@supabase/supabase-js"

import { getSupabaseServerClient } from "./supabase/server"

export async function getSession() {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export async function getUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return data.user
}

export async function requireUser(): Promise<User> {
  const user = await getUser()

  if (!user) {
    throw new Error("Authentication required")
  }

  return user
}
