/**
 * Test harness for validating adlob rotation logic
 * Verifies the Latin square property and collision detection
 */

import type { Player, AdLob } from "./types"

export interface RotationTestResult {
  success: boolean
  errors: string[]
  warnings: string[]
  latinSquare: number[][] // [playerIndex][phaseIndex] = adlobIndex
  assignments: {
    phase: number
    phaseName: string
    assignments: Array<{
      playerName: string
      playerIndex: number
      adlobIndex: number
      adlobId: string
    }>
  }[]
}

/**
 * Calculate the adlob assignment for a given player and phase
 */
export function calculateAssignment(
  playerIndex: number,
  phaseIndex: number,
  adlobCount: number
): number {
  return (playerIndex + phaseIndex) % adlobCount
}

/**
 * Test the rotation logic for a given set of players and adlobs
 */
export function testRotation(players: Player[], adlobs: AdLob[]): RotationTestResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Sort players by seatIndex (stable)
  const sortedPlayers = [...players].sort((a, b) => a.seatIndex - b.seatIndex)

  // Sort adlobs by ID (stable - since we don't have createdAt in the type anymore)
  const sortedAdlobs = [...adlobs].sort((a, b) => a.id.localeCompare(b.id))

  // Phase names
  const phaseNames = ["big_idea", "visual", "headline", "pitch"]
  const numPhases = 4

  // Build Latin square
  const latinSquare: number[][] = []
  const assignments: RotationTestResult["assignments"] = []

  for (let phaseIndex = 0; phaseIndex < numPhases; phaseIndex++) {
    const phaseAssignments: RotationTestResult["assignments"][0]["assignments"] = []

    for (let playerIndex = 0; playerIndex < sortedPlayers.length; playerIndex++) {
      const adlobIndex = calculateAssignment(playerIndex, phaseIndex, sortedAdlobs.length)

      if (!latinSquare[playerIndex]) {
        latinSquare[playerIndex] = []
      }
      latinSquare[playerIndex][phaseIndex] = adlobIndex

      const player = sortedPlayers[playerIndex]
      const adlob = sortedAdlobs[adlobIndex]

      if (!adlob) {
        errors.push(
          `Phase ${phaseIndex} (${phaseNames[phaseIndex]}): Player ${playerIndex} (${player?.name}) assigned to non-existent adlob index ${adlobIndex}`
        )
        continue
      }

      phaseAssignments.push({
        playerName: player.name,
        playerIndex,
        adlobIndex,
        adlobId: adlob.id,
      })
    }

    assignments.push({
      phase: phaseIndex,
      phaseName: phaseNames[phaseIndex],
      assignments: phaseAssignments,
    })

    // Check for collisions in this phase
    const adlobsUsedThisPhase = new Set<number>()
    for (const assignment of phaseAssignments) {
      if (adlobsUsedThisPhase.has(assignment.adlobIndex)) {
        errors.push(
          `Phase ${phaseIndex} (${phaseNames[phaseIndex]}): Collision detected - multiple players assigned to adlob index ${assignment.adlobIndex}`
        )
      }
      adlobsUsedThisPhase.add(assignment.adlobIndex)
    }
  }

  // Verify Latin square property: each player works on each adlob exactly once
  if (sortedPlayers.length === sortedAdlobs.length) {
    for (let playerIndex = 0; playerIndex < sortedPlayers.length; playerIndex++) {
      const adlobsForPlayer = new Set<number>()

      for (let phaseIndex = 0; phaseIndex < numPhases; phaseIndex++) {
        const adlobIndex = latinSquare[playerIndex][phaseIndex]
        if (adlobsForPlayer.has(adlobIndex)) {
          errors.push(
            `Player ${playerIndex} (${sortedPlayers[playerIndex].name}) assigned to adlob ${adlobIndex} more than once`
          )
        }
        adlobsForPlayer.add(adlobIndex)
      }

      // In a perfect Latin square, each player should work on each adlob exactly once
      if (adlobsForPlayer.size !== sortedAdlobs.length) {
        warnings.push(
          `Player ${playerIndex} (${sortedPlayers[playerIndex].name}) only worked on ${adlobsForPlayer.size}/${sortedAdlobs.length} adlobs`
        )
      }
    }
  } else {
    warnings.push(
      `Player count (${sortedPlayers.length}) != Adlob count (${sortedAdlobs.length}) - Latin square property cannot hold`
    )
  }

  // Verify each adlob is worked on by each player exactly once (column check)
  if (sortedPlayers.length === sortedAdlobs.length) {
    for (let adlobIndex = 0; adlobIndex < sortedAdlobs.length; adlobIndex++) {
      const playersForAdlob = new Set<number>()

      for (let playerIndex = 0; playerIndex < sortedPlayers.length; playerIndex++) {
        for (let phaseIndex = 0; phaseIndex < numPhases; phaseIndex++) {
          if (latinSquare[playerIndex][phaseIndex] === adlobIndex) {
            if (playersForAdlob.has(playerIndex)) {
              errors.push(
                `Adlob ${adlobIndex} (${sortedAdlobs[adlobIndex].id}) worked on by player ${playerIndex} more than once`
              )
            }
            playersForAdlob.add(playerIndex)
          }
        }
      }

      if (playersForAdlob.size !== sortedPlayers.length) {
        warnings.push(
          `Adlob ${adlobIndex} only worked on by ${playersForAdlob.size}/${sortedPlayers.length} players`
        )
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    latinSquare,
    assignments,
  }
}

/**
 * Format rotation test results as a readable string
 */
export function formatRotationTest(result: RotationTestResult): string {
  const lines: string[] = []

  if (result.success) {
    lines.push("✓ Rotation test PASSED")
  } else {
    lines.push("✗ Rotation test FAILED")
  }

  if (result.errors.length > 0) {
    lines.push("\nErrors:")
    result.errors.forEach((error) => lines.push(`  - ${error}`))
  }

  if (result.warnings.length > 0) {
    lines.push("\nWarnings:")
    result.warnings.forEach((warning) => lines.push(`  - ${warning}`))
  }

  lines.push("\nLatin Square:")
  lines.push("        " + ["big_idea", "visual", "headline", "pitch"].map((p, i) => `P${i}`).join("  "))
  result.latinSquare.forEach((row, playerIndex) => {
    lines.push(`Player ${playerIndex}: ${row.map((adlobIdx) => `A${adlobIdx}`).join("  ")}`)
  })

  lines.push("\nAssignments by Phase:")
  result.assignments.forEach(({ phase, phaseName, assignments }) => {
    lines.push(`\n${phaseName} (Phase ${phase}):`)
    assignments.forEach(({ playerName, playerIndex, adlobIndex, adlobId }) => {
      lines.push(`  ${playerName} (P${playerIndex}) -> Adlob ${adlobIndex} (${adlobId})`)
    })
  })

  return lines.join("\n")
}

/**
 * Generate test scenarios for different player/adlob counts
 */
export interface TestScenario {
  name: string
  description: string
  playerCount: number
  adlobCount: number
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    name: "3x3 Perfect Square",
    description: "3 players, 3 adlobs - perfect Latin square",
    playerCount: 3,
    adlobCount: 3,
  },
  {
    name: "4x4 Perfect Square",
    description: "4 players, 4 adlobs - perfect Latin square",
    playerCount: 4,
    adlobCount: 4,
  },
  {
    name: "5x5 Perfect Square",
    description: "5 players, 5 adlobs - perfect Latin square",
    playerCount: 5,
    adlobCount: 5,
  },
  {
    name: "6x6 Perfect Square",
    description: "6 players, 6 adlobs - perfect Latin square",
    playerCount: 6,
    adlobCount: 6,
  },
  {
    name: "4 Players, 3 Adlobs",
    description: "More players than adlobs - some adlobs reused",
    playerCount: 4,
    adlobCount: 3,
  },
  {
    name: "3 Players, 4 Adlobs",
    description: "More adlobs than players - some adlobs unused",
    playerCount: 3,
    adlobCount: 4,
  },
]
