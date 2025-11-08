import type { GameStatus } from "@/lib/types"

type RawPlayer = {
  id: string
  name: string
  emoji: string
  is_ready: boolean | null
  is_host: boolean | null
  joined_at: string | null
}

type RawBrief = {
  id: string
  product_name: string | null
  product_category: string | null
  main_point: string | null
  audience: string | null
  business_problem: string | null
  objective: string | null
  strategy: string | null
  product_features: string | null
  cover_image_url: string | null
  updated_at: string | null
}

type RawAdlob = {
  id: string
  big_idea_text: string | null
  big_idea_created_by: string | null
  visual_canvas_data: unknown
  visual_image_urls: string[] | null
  visual_created_by: string | null
  headline_canvas_data: unknown
  headline_created_by: string | null
  pitch_text: string | null
  pitch_created_by: string | null
  created_at: string | null
  assigned_presenter: string | null
  present_order: number | null
  present_started_at: string | null
  present_completed_at: string | null
  vote_count?: number | null
}

type RawGameRow = {
  id: string
  code: string
  status: string
  current_phase: string | null
  phase_start_time: string | null
  host_id: string
  current_present_index: number | null
  present_sequence: string[] | null
  product_category: string | null
  phase_duration_seconds: number | null
  brief_style: string | null
  version?: number | null
  players?: RawPlayer[] | null
  brief?: RawBrief[] | null
  campaign_briefs?: RawBrief[] | null
  adlobs?: RawAdlob[] | null
}

function serializePlayer(row: RawPlayer) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    isReady: Boolean(row.is_ready),
    isHost: Boolean(row.is_host),
    joinedAt: row.joined_at ?? new Date().toISOString(),
  }
}

function serializeBrief(row?: RawBrief | null) {
  if (!row) return null

  return {
    id: row.id,
    productName: row.product_name ?? "",
    productCategory: row.product_category ?? "All",
    mainPoint: row.main_point ?? "",
    audience: row.audience ?? "",
    businessProblem: row.business_problem ?? "",
    objective: row.objective ?? "",
    strategy: row.strategy ?? "",
    productFeatures: row.product_features ?? "",
    coverImageUrl: row.cover_image_url ?? undefined,
    updatedAt: row.updated_at ?? null,
  }
}

function serializeAdlob(row: RawAdlob) {
  return {
    id: row.id,
    bigIdea: row.big_idea_text,
    bigIdeaAuthorId: row.big_idea_created_by,
    visualCanvasData: row.visual_canvas_data,
    visualImageUrls: row.visual_image_urls ?? null,
    visualAuthorId: row.visual_created_by,
    headlineCanvasData: row.headline_canvas_data,
    headlineAuthorId: row.headline_created_by,
    pitch: row.pitch_text,
    pitchAuthorId: row.pitch_created_by,
    createdAt: row.created_at ?? new Date().toISOString(),
    assignedPresenterId: row.assigned_presenter,
    presentOrder: row.present_order,
    presentStartedAt: row.present_started_at,
    presentCompletedAt: row.present_completed_at,
    voteCount: row.vote_count ?? 0,
  }
}

export function serializeGameRow(row: RawGameRow) {
  const players = (row.players ?? []).map(serializePlayer)
  const briefCandidates = row.brief ?? row.campaign_briefs ?? []

  return {
    id: row.id,
    code: row.code,
    status: row.status as GameStatus,
    currentPhase: row.current_phase,
    phaseStartTime: row.phase_start_time,
    hostId: row.host_id,
    currentPresentIndex: row.current_present_index ?? null,
    presentSequence: Array.isArray(row.present_sequence) ? row.present_sequence : [],
    productCategory: row.product_category ?? "All",
    phaseDurationSeconds: row.phase_duration_seconds ?? 60,
    briefStyle: row.brief_style ?? "wacky",
    players,
    adlobs: (row.adlobs ?? []).map(serializeAdlob),
    brief: serializeBrief(briefCandidates[0]),
    version: typeof row.version === "number" ? row.version : 0,
  }
}

