# Adlob Rotation Testing Guide

## Quick Reference

**Problem**: Sketches didn't match text content, players got same adlobs (collisions)
**Root Cause**: Race condition in phase locking mechanism
**Fix**: Lock only when `phaseIndex` changes, not on every game state update
**Files Changed**:
- [app/create/[roomId]/page.tsx](app/create/[roomId]/page.tsx) - Fixed locking logic + added assertions
- [lib/test-adlob-rotation.ts](lib/test-adlob-rotation.ts) - Test harness
- [app/admin/test-rotation/page.tsx](app/admin/test-rotation/page.tsx) - Admin UI
- [ADLOB_ROTATION_DEBUG.md](ADLOB_ROTATION_DEBUG.md) - Detailed debugging guide

## Console Logs to Monitor

### 1. Phase Lock Changes (Expected Behavior)

When a phase advances, you should see:

```
[create] Phase index changed, recalculating lock
{
  oldPhase: 1,
  newPhase: 2,
  currentLock: "adlob-abc"
}

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

**What to verify**:
- Lock changes ONCE per phase transition
- `formula` calculation is correct
- `targetIndex` matches expected value

### 2. Assignment Mismatch (Bug Detected!)

If you see this, the lock was set incorrectly:

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

**Action**: Report this immediately - indicates the fix didn't work

### 3. Mid-Phase Reassignment (Critical Bug!)

If you see the same phase logged twice with different adlobIds:

```
[create] ✓ Locked adlob assignment { phase: "headline", adlobId: "adlob-abc", ... }
... (a few seconds later in same phase) ...
[create] ✓ Locked adlob assignment { phase: "headline", adlobId: "adlob-xyz", ... }
```

**This should NEVER happen** - the lock should only change when phase advances.

### 4. Missing Adlob Warning

```
[create] ⚠️  Locked adlob not found in game.adlobs!
{
  lockedAdlobId: "adlob-xyz",
  availableAdlobs: ["adlob-abc", "adlob-def"]
}
```

**Possible causes**: Stale lock, deleted adlob, or game state out of sync

## Manual Testing Checklist

### Test 1: Basic 3-Player Game

**Setup**:
- 3 players join
- Host starts game
- Generate brief
- Advance to creation phase

**During Each Phase**:
1. Open console for all 3 players
2. Filter by `[create]`
3. Verify each player sees different adlob assignment
4. Check formula calculation is correct
5. Verify no mismatch warnings

**Expected Latin Square (3 players, 3 adlobs)**:

| Phase    | Player 0 | Player 1 | Player 2 |
|----------|----------|----------|----------|
| big_idea | Adlob 0  | Adlob 1  | Adlob 2  |
| visual   | Adlob 1  | Adlob 2  | Adlob 0  |
| headline | Adlob 2  | Adlob 0  | Adlob 1  |
| pitch    | Adlob 0  | Adlob 1  | Adlob 2  |

### Test 2: Rapid Phase Transitions

**Setup**: 4-player game with 10-second phase duration

**During Game**:
1. Advance phases quickly (don't wait for timer)
2. Have multiple players submit content simultaneously
3. Watch console for mid-phase reassignments
4. Verify no collisions occur

**Expected**: Lock changes exactly 4 times (once per phase transition)

### Test 3: Realtime Event Storm

**Setup**: 4-player game

**During Creation Phase**:
1. Have all players submit content at same time
2. Trigger multiple realtime events (ready state changes, etc.)
3. Monitor console during phase transition
4. Verify lock doesn't change mid-phase

**Expected**: Lock stays stable despite realtime events

### Test 4: Content Continuity

**Setup**: 4-player game

**Verification Points**:
1. **After Visual Phase**: Take screenshot of canvas
2. **During Headline Phase**: Verify same canvas appears as starting point
3. **Check Big Idea Text**: Matches the product brief
4. **Check Visual Text**: Matches the canvas notes
5. **Final Pitch**: Contains all previous elements

**Expected**: Content from phase N appears in phase N+1

## Automated Testing

### Admin UI Tests

Visit `/admin/test-rotation` to run validation tests.

**Test Scenarios**:
1. 3x3 Perfect Square ✓
2. 4x4 Perfect Square ✓
3. 5x5 Perfect Square ✓
4. 4 Players, 3 Adlobs (some reuse) ✓
5. 3 Players, 4 Adlobs (some unused) ✓

**What Gets Validated**:
- No collisions (two players on same adlob)
- Proper rotation formula
- Latin square property (when player count = adlob count)
- Each player works on each adlob exactly once
- Each adlob is worked on by each player exactly once

**Example Output**:

```
✓ Rotation test PASSED

Latin Square:
        P0  P1  P2
Player 0: A0  A1  A2
Player 1: A1  A2  A0
Player 2: A2  A0  A1

Assignments by Phase:
big_idea (Phase 0):
  Player 1 (P0) -> Adlob 0 (adlob-0)
  Player 2 (P1) -> Adlob 1 (adlob-1)
  Player 3 (P2) -> Adlob 2 (adlob-2)
...
```

### Programmatic Testing

```typescript
import { testRotation } from "@/lib/test-adlob-rotation"

const players = [...] // Your test players
const adlobs = [...] // Your test adlobs

const result = testRotation(players, adlobs)

if (!result.success) {
  console.error("FAILED:", result.errors)
} else {
  console.log("PASSED ✓")
}
```

## Validation Criteria

### ✅ Success Indicators

- [ ] Console shows lock changes only when phase advances
- [ ] No "ASSIGNMENT MISMATCH" errors
- [ ] Each player sees different sketch each phase
- [ ] Big idea text matches visual sketch in headline
- [ ] Visual notes match the sketch they were created with
- [ ] Headline canvas shows correct visual from previous phase
- [ ] All `/admin/test-rotation` tests pass
- [ ] 4-player game completes without collisions
- [ ] Rapid phase transitions don't break assignment

### ❌ Failure Indicators

- [ ] "ASSIGNMENT MISMATCH DETECTED" in console
- [ ] Multiple lock changes in same phase
- [ ] Two players see same sketch
- [ ] Sketch doesn't match text content
- [ ] Mid-phase reassignment logs
- [ ] Latin square test failures

## Reproducing Original Bug

To confirm the fix worked, try to reproduce the original symptoms:

**Steps**:
1. 4-player game with 4 adlobs
2. Set phase duration to 10 seconds
3. Advance quickly through phases
4. Multiple players submit simultaneously
5. Trigger realtime events during transitions

**Before Fix**:
- Collisions occurred frequently
- Sketches mismatched text
- 2+ players got same adlob

**After Fix**:
- No collisions
- Sketches match text
- Deterministic assignments

## Edge Cases to Test

### Edge Case 1: Player Disconnects Mid-Game

**Test**: Have a player disconnect during creation phase

**Expected**:
- Remaining players keep their assignments
- No reassignment mid-phase
- Formula still works with updated player count

### Edge Case 2: More Players Than Adlobs

**Test**: 4 players, 3 adlobs

**Expected**:
- Some adlobs get reused (formula wraps around)
- No collisions in same phase
- Pattern still deterministic

### Edge Case 3: More Adlobs Than Players

**Test**: 3 players, 4 adlobs

**Expected**:
- Some adlobs stay unused
- No collisions
- Players cycle through adlobs

### Edge Case 4: Very Fast Phase Transitions

**Test**: Advance phases every 2 seconds

**Expected**:
- Lock updates correctly each time
- No race conditions
- No stale assignments

## Common Issues & Solutions

### Issue: "Cannot lock - missing game data"

**Console Log**:
```
[create] Cannot lock - missing game data
{ hasGame: true, hasPlayer: false, adlobCount: 0 }
```

**Cause**: Game state not fully loaded
**Solution**: Wait for game fetch to complete

### Issue: Player Not Found in Sorted List

**Console Log**:
```
[create] Player not found in sorted players list
{ playerId: "abc", players: [...] }
```

**Cause**: Player hasn't been assigned seatIndex
**Solution**: Check player join logic

### Issue: Failed to Find Assigned Adlob

**Console Log**:
```
[create] Failed to find assigned adlob
{ targetIndex: 3, adlobCount: 3 }
```

**Cause**: Formula produced out-of-bounds index
**Solution**: Check modulo calculation

## Performance Impact

The fix adds minimal overhead:

**Before**: 1 lock update per game state change (BAD - race condition)
**After**: 1 lock update per phase transition (GOOD - only 4 times per game)

**Memory**: +1 `useRef` (prevPhaseIndexRef)
**CPU**: Negligible (phase index comparison)
**Network**: No change

## Related Documentation

- [ADLOB_ROTATION_DEBUG.md](ADLOB_ROTATION_DEBUG.md) - Detailed debugging guide
- [CLAUDE.md](CLAUDE.md) - Project documentation (see "Adlob Assignment & Rotation Logic")
- [PERFORMANCE_FIX_PLAN.md](PERFORMANCE_FIX_PLAN.md) - Performance optimization history

## Questions?

If you encounter issues not covered here:

1. Check console for debug logs (filter by `[create]`)
2. Run `/admin/test-rotation` automated tests
3. Review [ADLOB_ROTATION_DEBUG.md](ADLOB_ROTATION_DEBUG.md) for detailed analysis
4. Look for the ⚠️ emoji in console - indicates problems
