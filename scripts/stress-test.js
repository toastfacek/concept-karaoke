#!/usr/bin/env node

/**
 * Stress Test for Concept Karaoke
 *
 * Tests:
 * 1. Game creation
 * 2. Concurrent player joins (8 players)
 * 3. Seat index uniqueness and ordering
 * 4. Concurrent fetch deduplication (20 simultaneous requests)
 * 5. Version consistency across responses
 *
 * Usage:
 *   node scripts/stress-test.js
 *   BASE_URL=https://your-app.vercel.app node scripts/stress-test.js
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"

async function stressTest() {
  console.log("🚀 Starting 8-player stress test...\n")
  console.log(`Target: ${BASE_URL}\n`)

  // Step 1: Create game
  console.log("📝 Creating game...")
  const createRes = await fetch(`${BASE_URL}/api/games/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hostName: "Host Player",
      hostEmoji: "🎮",
      productCategory: "tech",
    }),
  })

  if (!createRes.ok) {
    console.error("❌ Failed to create game:", await createRes.text())
    process.exit(1)
  }

  const createData = await createRes.json()
  if (!createData.success) {
    console.error("❌ Game creation failed:", createData.error)
    process.exit(1)
  }

  const { room, player: host } = createData
  console.log(`✅ Game created: ${room.code}`)
  console.log(`   Host: ${host.name} (${host.emoji}) - seatIndex: ${host.seatIndex}\n`)

  // Step 2: Join 7 more players concurrently
  console.log("👥 Joining 7 more players concurrently...")
  const joinPromises = []
  for (let i = 1; i <= 7; i++) {
    joinPromises.push(
      fetch(`${BASE_URL}/api/games/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: room.code,
          playerName: `Player ${i}`,
          playerEmoji: `😀`,
        }),
      }).then((r) => r.json())
    )
  }

  const joinResults = await Promise.all(joinPromises)
  const allPlayers = [host, ...joinResults.map((r) => r.player)]

  console.log(`✅ ${allPlayers.length} players joined`)
  allPlayers.forEach((p) => {
    console.log(`   ${p.name} (${p.emoji}) - seatIndex: ${p.seatIndex}`)
  })
  console.log()

  // Step 3: Check seat indices are unique
  console.log("🔢 Checking seat index uniqueness...")
  const seatIndices = allPlayers.map((p) => p.seatIndex).sort((a, b) => a - b)
  const expected = [0, 1, 2, 3, 4, 5, 6, 7]
  const isCorrect = JSON.stringify(seatIndices) === JSON.stringify(expected)

  if (isCorrect) {
    console.log(`✅ Seat indices: PASS`, seatIndices)
  } else {
    console.log(`❌ Seat indices: FAIL`)
    console.log(`   Expected: ${JSON.stringify(expected)}`)
    console.log(`   Actual:   ${JSON.stringify(seatIndices)}`)
    process.exit(1)
  }
  console.log()

  // Step 4: Spam concurrent fetches (test deduplication)
  console.log("🔥 Spamming 20 concurrent fetches...")
  const fetchPromises = Array(20)
    .fill(null)
    .map(() => fetch(`${BASE_URL}/api/games/${room.id}`).then((r) => r.json()))

  const fetchResults = await Promise.all(fetchPromises)
  console.log(`✅ All fetches completed (${fetchResults.length} responses)`)

  // Step 5: Verify version consistency
  console.log("\n📊 Checking version consistency...")
  const versions = fetchResults.map((r) => r.game?.version)
  const allSameVersion = versions.every((v) => v === versions[0])

  if (allSameVersion) {
    console.log(`✅ Version consistency: PASS (all responses have version ${versions[0]})`)
  } else {
    console.log(`❌ Version consistency: FAIL`)
    console.log(`   Versions found: ${JSON.stringify(versions)}`)
    process.exit(1)
  }

  // Step 6: Verify player count
  const playerCounts = fetchResults.map((r) => r.game?.players?.length)
  const allHave8Players = playerCounts.every((c) => c === 8)

  if (allHave8Players) {
    console.log(`✅ Player count: PASS (all responses have 8 players)`)
  } else {
    console.log(`❌ Player count: FAIL`)
    console.log(`   Counts found: ${JSON.stringify(playerCounts)}`)
    process.exit(1)
  }

  console.log("\n✨ Stress test complete!")
  console.log("\n📈 Summary:")
  console.log(`   - Game code: ${room.code}`)
  console.log(`   - Players joined: ${allPlayers.length}`)
  console.log(`   - Concurrent fetches: ${fetchResults.length}`)
  console.log(`   - Seat indices: ✅ Correct`)
  console.log(`   - Version consistency: ✅ Pass`)
  console.log(`   - Player count: ✅ Pass`)
  console.log("\n🎉 All tests passed!")
}

stressTest().catch((error) => {
  console.error("\n❌ Stress test failed:", error)
  process.exit(1)
})
