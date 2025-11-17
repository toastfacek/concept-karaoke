# Adlob Rotation Bug Fix & Debugging Guide

## Problem Summary

During gameplay testing, the following issues were observed:
1. **Sketch/text mismatch**: In headline round, sketches didn't match the big idea writeup
2. **Visual content mismatch**: Visual writeup didn't match the sketch
3. **Incomplete rotation**: Sketch didn't switch for players 1+2, but big idea/visual text did switch
4. **Collision**: 2/4 players got assigned the same sketch

## Root Cause

**Race condition in the phase locking mechanism** ([app/create/[roomId]/page.tsx:638-642](app/create/[roomId]/page.tsx#L638-L642))

### The Bug

The `useEffect` that sets `lockedAdlobId` depended on BOTH `phaseIndex` AND `calculatedAdlob`:

```typescript
// ❌ BUGGY CODE (before fix)
useEffect(() => {
  if (phaseIndex !== -1 && calculatedAdlob) {
    setLockedAdlobId(calculatedAdlob.id)
  }
}, [phaseIndex, calculatedAdlob])  // calculatedAdlob changes on every game state update!
```

**Why this caused the bug**:
1. When phase advances, `phaseIndex` changes from 1 → 2
2. `calculatedAdlob` needs to recalculate with new `phaseIndex`
3. But `calculatedAdlob` also depends on `game` state
4. If a realtime event updates `game` state WHILE this is happening...
5. `calculatedAdlob` recalculates AGAIN with partial/stale data
6. Lock gets set to the WRONG adlob ID
7. Players see content from one adlob but sketches from another

### The Fix

Lock ONLY when `phaseIndex` changes (not when `calculatedAdlob` changes):

```typescript
// ✅ FIXED CODE
const prevPhaseIndexRef = useRef<number>(-1)

useEffect(() => {
  // Only lock when phase index CHANGES
  if (phaseIndex === prevPhaseIndexRef.current) {
    return
  }

  prevPhaseIndexRef.current = phaseIndex

  // Recalculate assignment INSIDE effect to avoid stale closures
  if (!game || !currentPlayer || phaseIndex === -1) return

  const sortedPlayers = [...game.players].sort((a, b) => a.seatIndex - b.seatIndex)
  const playerIdx = sortedPlayers.findIndex((player) => player.id === currentPlayer.id)

  const sortedAdlobs = [...game.adlobs].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime()
    const timeB = new Date(b.createdAt).getTime()
    if (timeA !== timeB) return timeA - timeB
    return a.id.localeCompare(b.id)
  })

  const targetIndex = (playerIdx + phaseIndex) % sortedAdlobs.length
  const assignedAdlob = sortedAdlobs[targetIndex]

  if (assignedAdlob) {
    setLockedAdlobId(assignedAdlob.id)
    // ... logging
  }
}, [phaseIndex, game, currentPlayer])
```

**Key improvements**:
1. Only runs when `phaseIndex` actually changes (not on every render)
2. Uses `useRef` to track previous phase index
3. Recalculates assignment inside effect (avoids stale closure values)
4. Comprehensive logging for debugging

## Debug Logs to Monitor

### 1. Phase Lock Changes

Look for this log when phases advance:

```
[create] ✓ Locked adlob assignment
{
  phase: "headline",
  phaseIndex: 2,
  playerIdx: 0,
  playerName: "Alice",
  adlobId: "adlob-xyz",
  targetIndex: 2,
  formula: "(0 + 2) % 3 = 2",
  allAdlobs: [...]
}
```

**What to check**:
- `formula` calculation is correct
- `targetIndex` matches expected value
- `adlobId` matches the adlob at `targetIndex`

### 2. Assignment Mismatch Alerts

The runtime assertion will trigger if assignment doesn't match formula:

```
[create] ⚠️  ASSIGNMENT MISMATCH DETECTED!
{
  playerName: "Alice",
  playerIdx: 0,
  phaseIndex: 2,
  phase: "headline",
  expected: "adlob-abc",
  actual: "adlob-xyz",
  formula: "(0 + 2) % 3 = 2"
}
```

**If you see this**:
- The lock was set to wrong adlob
- Race condition occurred
- Check timing of realtime events around phase transition

### 3. Mid-Phase Reassignment

If you see multiple "Locked adlob assignment" logs for the same phase, the lock changed mid-phase (BAD!):

```
[create] ✓ Locked adlob assignment { phase: "headline", phaseIndex: 2, ... }
[create] ✓ Locked adlob assignment { phase: "headline", phaseIndex: 2, ... }  // ❌ SHOULD NOT HAPPEN
```

This indicates the fix didn't work or there's another issue.

### 4. Missing Adlob Warnings

```
[create] ⚠️  Locked adlob not found in game.adlobs!
{
  lockedAdlobId: "adlob-xyz",
  availableAdlobs: ["adlob-abc", "adlob-def"]
}
```

**Possible causes**:
- Adlob was deleted from database
- Game state is out of sync
- Lock points to stale adlob ID

## Testing Scenarios

### Manual Testing (Console Logs)

When testing in development:

1. **Open browser console for ALL players** (use multiple browser windows/incognito)
2. **Filter logs by `[create]`** to see assignment logs
3. **Watch for the ⚠️ emoji** in console - indicates problems
4. **Verify Latin square pattern**:
   - Each player should see different adlob each phase
   - No two players should have same adlob in same phase

### Automated Testing (Admin UI)

Visit [/admin/test-rotation](/admin/test-rotation) to run validation tests:

**Test Scenarios**:
1. **3x3 Perfect Square** - 3 players, 3 adlobs (ideal Latin square)
2. **4x4 Perfect Square** - 4 players, 4 adlobs (ideal Latin square)
3. **5x5 Perfect Square** - 5 players, 5 adlobs (maximum capacity)
4. **4 Players, 3 Adlobs** - More players than adlobs (some reuse)
5. **3 Players, 4 Adlobs** - More adlobs than players (some unused)

**What the tests verify**:
- No collisions (two players on same adlob)
- Proper rotation pattern
- Latin square property (when player count = adlob count)
- Stable sorting (players by `seatIndex`, adlobs by `createdAt`)

### Test Harness Usage (Programmatic)

```typescript
import { testRotation, formatRotationTest } from "@/lib/test-adlob-rotation"

const players = [...] // Mock players sorted by seatIndex
const adlobs = [...] // Mock adlobs sorted by createdAt

const result = testRotation(players, adlobs)

if (!result.success) {
  console.error("Rotation test FAILED!")
  console.error(result.errors)
}

console.log(formatRotationTest(result))
```

## Validation Checklist

After deploying the fix, verify:

- [ ] Console logs show lock only changes when phase advances (not mid-phase)
- [ ] No "ASSIGNMENT MISMATCH DETECTED" errors in console
- [ ] Each player sees different sketch/content each phase
- [ ] Big idea text matches the visual sketch in headline phase
- [ ] Visual notes match the sketch they were created with
- [ ] Headline canvas shows the correct visual from previous phase
- [ ] All automated tests in `/admin/test-rotation` pass
- [ ] 4-player game completes without collisions
- [ ] Rapid realtime events don't trigger reassignment

## How to Reproduce the Original Bug

To verify the fix worked, try to reproduce the original bug:

1. Start a 4-player game with 4 adlobs
2. Advance through phases quickly (< 5 seconds per phase)
3. Have multiple players submit content simultaneously
4. Trigger realtime events during phase transitions
5. Check console for mismatch warnings
6. Verify sketches match text content

**Before fix**: Mismatches occurred frequently
**After fix**: No mismatches, deterministic assignments

## Related Files

- [app/create/[roomId]/page.tsx](app/create/[roomId]/page.tsx) - Fixed locking logic (lines 638-709)
- [lib/test-adlob-rotation.ts](lib/test-adlob-rotation.ts) - Test harness with validation functions
- [app/admin/test-rotation/page.tsx](app/admin/test-rotation/page.tsx) - Admin UI for testing scenarios
- [lib/types.ts](lib/types.ts) - Player and AdLob type definitions
- [CLAUDE.md](CLAUDE.md) - Project documentation (see "Adlob Assignment & Rotation Logic" section)

## Additional Notes

### Why the Rotation Formula is Correct

The formula `(playerIndex + phaseIndex) % adlobCount` is mathematically sound:

- Creates a Latin square when `playerCount === adlobCount`
- Each player works on different adlob each phase
- Each adlob is worked on by different player each phase
- Deterministic (same inputs → same outputs)

**Example (3 players, 3 adlobs)**:

| Phase      | P0     | P1     | P2     |
|------------|--------|--------|--------|
| big_idea   | Adlob0 | Adlob1 | Adlob2 |
| visual     | Adlob1 | Adlob2 | Adlob0 |
| headline   | Adlob2 | Adlob0 | Adlob1 |
| pitch      | Adlob0 | Adlob1 | Adlob2 |

The bug was NOT in the formula - it was in the TIMING of when the lock was set.

### Why We Need Stable Sorting

Both players and adlobs MUST be sorted consistently:

- **Players**: Sorted by `seatIndex` (assigned at join time)
- **Adlobs**: Sorted by `createdAt` (with `id` as tiebreaker)

Without stable sorting:
- Realtime events could reorder arrays mid-session
- `playerIndex` could change for same player
- Formula would produce different results
- Collisions would occur

### Canvas vs Text Content

The bug manifested differently for visual content vs text:

- **Text content** (bigIdea, visual notes, headline, pitch): Fetched from `currentAdlob` which uses `lockedAdlobId`
- **Visual content** (canvas sketches): Rendered from `currentAdlob.visualCanvasData` and `currentAdlob.headlineCanvasData`

When the lock pointed to wrong adlob:
- Text updated correctly (from database)
- Canvas persisted in component state (stale reference)
- Result: Sketch from Adlob A, text from Adlob B

This is why the headline phase showed "sketch didn't match big idea writeup".
