export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      adlobs: {
        Row: {
          assigned_presenter: string | null
          big_idea_created_by: string | null
          big_idea_text: string | null
          brief_id: string | null
          created_at: string | null
          headline_canvas_data: Json | null
          headline_created_by: string | null
          id: string
          pitch_created_by: string | null
          pitch_text: string | null
          present_completed_at: string | null
          present_order: number | null
          present_started_at: string | null
          room_id: string
          updated_at: string | null
          visual_canvas_data: Json | null
          visual_created_by: string | null
          visual_image_urls: string[] | null
          vote_count: number | null
        }
        Insert: {
          assigned_presenter?: string | null
          big_idea_created_by?: string | null
          big_idea_text?: string | null
          brief_id?: string | null
          created_at?: string | null
          headline_canvas_data?: Json | null
          headline_created_by?: string | null
          id?: string
          pitch_created_by?: string | null
          pitch_text?: string | null
          present_completed_at?: string | null
          present_order?: number | null
          present_started_at?: string | null
          room_id: string
          updated_at?: string | null
          visual_canvas_data?: Json | null
          visual_created_by?: string | null
          visual_image_urls?: string[] | null
          vote_count?: number | null
        }
        Update: {
          assigned_presenter?: string | null
          big_idea_created_by?: string | null
          big_idea_text?: string | null
          brief_id?: string | null
          created_at?: string | null
          headline_canvas_data?: Json | null
          headline_created_by?: string | null
          id?: string
          pitch_created_by?: string | null
          pitch_text?: string | null
          present_completed_at?: string | null
          present_order?: number | null
          present_started_at?: string | null
          room_id?: string
          updated_at?: string | null
          visual_canvas_data?: Json | null
          visual_created_by?: string | null
          visual_image_urls?: string[] | null
          vote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "adlobs_assigned_pitcher_fkey"
            columns: ["assigned_presenter"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adlobs_big_idea_created_by_fkey"
            columns: ["big_idea_created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adlobs_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "campaign_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adlobs_headline_created_by_fkey"
            columns: ["headline_created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adlobs_mantra_created_by_fkey"
            columns: ["pitch_created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adlobs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adlobs_visual_created_by_fkey"
            columns: ["visual_created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_briefs: {
        Row: {
          business_problem: string
          created_at: string | null
          id: string
          objective: string
          product_category: string
          product_name: string
          room_id: string
          target_audience: string
          updated_at: string | null
        }
        Insert: {
          business_problem: string
          created_at?: string | null
          id?: string
          objective: string
          product_category: string
          product_name: string
          room_id: string
          target_audience: string
          updated_at?: string | null
        }
        Update: {
          business_problem?: string
          created_at?: string | null
          id?: string
          objective?: string
          product_category?: string
          product_name?: string
          room_id?: string
          target_audience?: string
          updated_at?: string | null
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
      game_rooms: {
        Row: {
          code: string
          created_at: string | null
          current_phase: string | null
          current_present_index: number | null
          host_id: string
          id: string
          phase_duration_seconds: number | null
          phase_start_time: string | null
          present_sequence: string[] | null
          product_category: string | null
          status: string
          version: number
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          current_phase?: string | null
          current_present_index?: number | null
          host_id: string
          id?: string
          phase_duration_seconds?: number | null
          phase_start_time?: string | null
          present_sequence?: string[] | null
          product_category?: string | null
          status: string
          version?: number
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_phase?: string | null
          current_present_index?: number | null
          host_id?: string
          id?: string
          phase_duration_seconds?: number | null
          phase_start_time?: string | null
          present_sequence?: string[] | null
          product_category?: string | null
          status?: string
          version?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      players: {
        Row: {
          disconnected: boolean | null
          emoji: string
          id: string
          is_host: boolean | null
          is_ready: boolean | null
          joined_at: string | null
          name: string
          room_id: string
        }
        Insert: {
          disconnected?: boolean | null
          emoji: string
          id?: string
          is_host?: boolean | null
          is_ready?: boolean | null
          joined_at?: string | null
          name: string
          room_id: string
        }
        Update: {
          disconnected?: boolean | null
          emoji?: string
          id?: string
          is_host?: boolean | null
          is_ready?: boolean | null
          joined_at?: string | null
          name?: string
          room_id?: string
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
      votes: {
        Row: {
          adlob_id: string
          created_at: string | null
          id: string
          room_id: string
          voter_id: string
        }
        Insert: {
          adlob_id: string
          created_at?: string | null
          id?: string
          room_id: string
          voter_id: string
        }
        Update: {
          adlob_id?: string
          created_at?: string | null
          id?: string
          room_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_adlob_id_fkey"
            columns: ["adlob_id"]
            isOneToOne: false
            referencedRelation: "adlobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "players"
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
