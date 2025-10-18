export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type GameStatus = "lobby" | "briefing" | "creating" | "pitching" | "voting" | "results"
export type CreationPhase = "big_idea" | "visual" | "headline" | "mantra" | "pitch"

export type Database = {
  public: {
    Tables: {
      game_rooms: {
        Row: {
          id: string
          code: string
          status: GameStatus
          current_phase: CreationPhase | null
          phase_start_time: string | null
          host_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          status?: GameStatus
          current_phase?: CreationPhase | null
          phase_start_time?: string | null
          host_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          status?: GameStatus
          current_phase?: CreationPhase | null
          phase_start_time?: string | null
          host_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          id: string
          room_id: string
          name: string
          emoji: string
          is_ready: boolean
          is_host: boolean
          disconnected: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          room_id: string
          name: string
          emoji: string
          is_ready?: boolean
          is_host?: boolean
          disconnected?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          name?: string
          emoji?: string
          is_ready?: boolean
          is_host?: boolean
          disconnected?: boolean
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_briefs: {
        Row: {
          id: string
          room_id: string
          product_name: string
          product_category: string
          business_problem: string
          target_audience: string
          objective: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_id: string
          product_name: string
          product_category: string
          business_problem: string
          target_audience: string
          objective: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          product_name?: string
          product_category?: string
          business_problem?: string
          target_audience?: string
          objective?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_briefs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
