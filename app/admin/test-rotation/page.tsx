"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  testRotation,
  formatRotationTest,
  TEST_SCENARIOS,
  type TestScenario,
  type RotationTestResult,
} from "@/lib/test-adlob-rotation"
import type { Player, AdLob } from "@/lib/types"
import { emojis } from "@/lib/sample-data"

/**
 * Admin page for testing adlob rotation logic
 */
export default function TestRotationPage() {
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null)
  const [testResult, setTestResult] = useState<RotationTestResult | null>(null)

  const runTest = (scenario: TestScenario) => {
    setSelectedScenario(scenario)

    // Generate mock players
    const players: Player[] = Array.from({ length: scenario.playerCount }, (_, i) => ({
      id: `player-${i}`,
      roomId: "test-room",
      name: `Player ${i + 1}`,
      emoji: emojis[i % emojis.length],
      isReady: false,
      isHost: i === 0,
      joinedAt: new Date(Date.now() + i * 1000), // Stagger by 1 second
      seatIndex: i,
    }))

    // Generate mock adlobs
    const adlobs: AdLob[] = Array.from({ length: scenario.adlobCount }, (_, i) => ({
      id: `adlob-${i}`,
      roomId: "test-room",
      briefId: `brief-${i}`,
      bigIdea: {
        text: "",
        createdBy: "",
      },
      visual: {
        canvasData: null,
        imageUrls: [],
        createdBy: "",
      },
      headline: {
        canvasData: null,
        createdBy: "",
      },
      pitch: {
        text: "",
        createdBy: "",
      },
      assignedPresenter: null,
      voteCount: 0,
    }))

    const result = testRotation(players, adlobs)
    setTestResult(result)
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Adlob Rotation Test Suite</h1>
        <p className="text-muted-foreground">
          Test the adlob assignment logic with different player/adlob counts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {TEST_SCENARIOS.map((scenario) => (
          <Card key={scenario.name}>
            <CardHeader>
              <CardTitle className="text-lg">{scenario.name}</CardTitle>
              <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-4">
                {scenario.playerCount} players × {scenario.adlobCount} adlobs
              </div>
              <Button onClick={() => runTest(scenario)} className="w-full">
                Run Test
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {testResult && selectedScenario && (
        <Card>
          <CardHeader>
            <CardTitle>
              Test Results: {selectedScenario.name}{" "}
              {testResult.success ? (
                <span className="text-green-600">✓ PASSED</span>
              ) : (
                <span className="text-red-600">✗ FAILED</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResult.errors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-red-600 mb-2">Errors</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {testResult.errors.map((error, i) => (
                    <li key={i} className="text-red-600">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {testResult.warnings.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-yellow-600 mb-2">Warnings</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {testResult.warnings.map((warning, i) => (
                    <li key={i} className="text-yellow-600">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Latin Square</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 bg-gray-100">Player</th>
                      <th className="border border-gray-300 px-4 py-2 bg-gray-100">Big Idea</th>
                      <th className="border border-gray-300 px-4 py-2 bg-gray-100">Visual</th>
                      <th className="border border-gray-300 px-4 py-2 bg-gray-100">Headline</th>
                      <th className="border border-gray-300 px-4 py-2 bg-gray-100">Pitch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResult.latinSquare.map((row, playerIndex) => (
                      <tr key={playerIndex}>
                        <td className="border border-gray-300 px-4 py-2 font-medium">
                          Player {playerIndex}
                        </td>
                        {row.map((adlobIndex, phaseIndex) => (
                          <td
                            key={phaseIndex}
                            className="border border-gray-300 px-4 py-2 text-center"
                          >
                            Adlob {adlobIndex}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Assignments by Phase</h3>
              <div className="space-y-4">
                {testResult.assignments.map(({ phase, phaseName, assignments }) => (
                  <div key={phase}>
                    <h4 className="font-medium text-sm uppercase text-muted-foreground mb-2">
                      {phaseName} (Phase {phase})
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {assignments.map(({ playerName, playerIndex, adlobIndex, adlobId }, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            P{playerIndex}
                          </span>
                          <span>{playerName}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded">
                            A{adlobIndex}
                          </span>
                          <span className="text-xs text-muted-foreground">{adlobId}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold mb-2">Raw Output</h3>
              <pre className="text-xs whitespace-pre-wrap">{formatRotationTest(testResult)}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
