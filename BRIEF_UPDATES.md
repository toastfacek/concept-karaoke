# Campaign Brief UI Updates

This document summarizes the comprehensive updates made to the campaign brief system on 2025-11-08.

## Overview

The campaign brief components were redesigned to match a cleaner, more professional layout with proper bullet point rendering and improved typography hierarchy.

## Changes Made

### 1. Updated CampaignBrief Type Definition

**File**: `lib/types.ts`

Expanded from 5 fields to 9 fields:

```typescript
interface CampaignBrief {
  productName: string           // Product name
  productCategory: string       // Category (from game settings)
  coverImageUrl?: string        // Optional product image URL
  mainPoint: string             // 4-8 word campaign message
  audience: string              // 1-2 bullet points (newline-separated)
  businessProblem: string       // 1-3 bullet points (newline-separated)
  objective: string             // Single paragraph
  strategy: string              // 1-2 sentences
  productFeatures: string       // 3 bullet points (newline-separated)
}
```

**Key Changes**:
- Added `coverImageUrl`, `mainPoint`, `strategy`, `productFeatures`
- Renamed `targetAudience` → `audience`
- All bullet fields use `\n` to separate individual points

### 2. Redesigned BriefEditor Component

**File**: `components/brief-editor.tsx`

**New Layout**:
- **Two-column grid** (responsive):
  - **Left**: Product image with diagonal stripe placeholder when no image
  - **Right**: Product name, category, main point, audience
- **Bottom 2x2 grid**: Business Problem, Objective, Strategy, Product Features

**New Features**:
- `parseBullets()` function splits newline-separated text into arrays
- `renderField()` updated with `showBullets` parameter
- Bullet fields render as proper `<ul>` with `<li>` elements
- Product name displays as large purple heading (text-2xl, purple-600)
- Section headings remain monospace uppercase (font-mono text-xs)
- Image placeholder uses CSS gradient diagonal stripes

**Typography Improvements**:
- Product Name: text-2xl font-bold text-purple-600
- Section headings: font-mono text-xs uppercase
- Body text: text-sm leading-relaxed

### 3. Updated BriefViewDialog Component

**File**: `components/brief-view-dialog.tsx`

**Changes**:
- Removed local `CampaignBrief` interface, now imports from `@/lib/types`
- Applied same two-column layout as BriefEditor
- Added `parseBullets()` function
- Bullet fields render as `<ul>` lists
- Consistent typography with BriefEditor
- Read-only presentation (no edit controls)

### 4. Fixed Type Consistency

**File**: `app/create/[roomId]/page.tsx`

**Changes**:
- Updated local `CampaignBrief` type to match new 9-field structure
- Fixed brief mapping in snapshot merge:
  ```typescript
  brief: gameData.brief ? {
    productName: gameData.brief.productName,
    productCategory: gameData.brief.productCategory,
    coverImageUrl: gameData.brief.coverImageUrl,
    mainPoint: gameData.brief.mainPoint,
    audience: gameData.brief.audience,
    businessProblem: gameData.brief.businessProblem,
    objective: gameData.brief.objective,
    strategy: gameData.brief.strategy,
    productFeatures: gameData.brief.productFeatures,
  } : null
  ```

### 5. Updated Documentation

**Files Updated**:
- `CLAUDE.md` - Added detailed Brief UI Components section
- `README.md` - Added Campaign Brief Structure section
- `SCREEN_FLOW.md` - Updated Brief Screen description with new layout details
- `concept-karaoke-prd.md` - Updated CampaignBrief interface definition

**Documentation Additions**:
- Detailed field descriptions and expected formats
- Bullet point parsing behavior
- Layout structure (two-column + bottom grid)
- Typography hierarchy
- Design decisions (image placeholder, responsive grid, cassette aesthetic)

## Design Decisions

### Bullet Point Parsing

**Format**: Newline-separated strings (`\n`)
**Rendering**: Automatically split and rendered as HTML `<ul><li>` elements
**Fields**: `audience`, `businessProblem`, `productFeatures`

**Example**:
```typescript
audience: "Tech-savvy millennials\nEarly adopters interested in sustainability"
// Renders as:
// • Tech-savvy millennials
// • Early adopters interested in sustainability
```

### Image Placeholder

When `coverImageUrl` is null, displays a diagonal stripe pattern:

```tsx
<div className="flex aspect-[4/3] items-center justify-center rounded border-2 border-border bg-gradient-to-br from-muted/30 to-muted/10 bg-[length:10px_10px] [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,hsl(var(--muted))_5px,hsl(var(--muted))_6px)]">
  <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground/50">
    &lt;Product Image&gt;
  </span>
</div>
```

### Responsive Grid

- **Desktop** (`md:` and up): Two columns (`md:grid-cols-[1fr,1fr]`)
- **Mobile**: Single column (stacked)
- **Bottom grid**: 2x2 on desktop, stacked on mobile

### Typography Hierarchy

1. **Product Name**: Most prominent (text-2xl, bold, purple)
2. **Section Headings**: Small labels (font-mono text-xs uppercase)
3. **Body Text**: Readable size (text-sm leading-relaxed)

## Component Usage

### BriefEditor

Used in briefing stage (`/brief/[roomId]`):

```tsx
<BriefEditor
  initialBrief={brief}
  onChange={(updated) => handleBriefChange(updated)}
  onLock={(final) => handleLockBrief(final)}
  onRegenerate={() => regenerateBrief()}
  isLocked={isLocked}
  isLocking={isLocking}
  showReveal={true}
/>
```

### BriefViewDialog

Used during creation/presentation stages:

```tsx
<BriefViewDialog
  brief={game.brief}
  isOpen={isBriefDialogOpen}
  onOpenChange={setIsBriefDialogOpen}
/>
```

## Testing

All changes are type-safe and pass TypeScript compilation:

```bash
pnpm exec tsc --noEmit
```

The components maintain all existing functionality while providing:
- Better visual hierarchy
- Proper bullet rendering
- Cleaner, more professional appearance
- Consistent layout between editable and read-only views

## Files Changed

- `components/brief-editor.tsx` - Layout + bullet parsing
- `components/brief-view-dialog.tsx` - Matching layout + type import
- `app/create/[roomId]/page.tsx` - Type consistency fix
- `lib/types.ts` - Already had correct 9-field structure
- `CLAUDE.md` - Architecture documentation
- `README.md` - Testing and structure documentation
- `SCREEN_FLOW.md` - Screen flow documentation
- `concept-karaoke-prd.md` - PRD interface definition

## Migration Notes

No database migration needed - the `campaign_briefs` table in Supabase already has all 9 fields with snake_case column names:

- `product_name`
- `product_category`
- `cover_image_url`
- `main_point`
- `audience`
- `business_problem`
- `objective`
- `strategy`
- `product_features`

API routes and brief generation already use the correct field structure.

---

# Brief Generation Fix - Missing Environment Variables (2025-11-08 Update)

## Issue
Brief generation is failing silently because the realtime server is rejecting broadcast requests from API routes.

## Root Cause
Missing `REALTIME_BROADCAST_SECRET` environment variable on Railway realtime server.

## Error Log
```
broadcast_no_secret_configured
```

## Fix: Add Missing Environment Variables to Railway

### 1. Generate a Shared Secret
```bash
# Generate a random secret (or use any long random string)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Add to Railway Realtime Server
Go to your Railway project → Realtime Server → Variables:

**Add these variables:**
- `REALTIME_BROADCAST_SECRET` = `<your_generated_secret>`
- `REALTIME_SHARED_SECRET` = `<same_or_different_secret_for_jwt>`

### 3. Add to Vercel (Next.js App)
Go to Vercel project → Settings → Environment Variables:

**Add these variables:**
- `REALTIME_BROADCAST_SECRET` = `<same_secret_as_railway>`
- `REALTIME_SHARED_SECRET` = `<same_secret_as_railway>`
- `NEXT_PUBLIC_REALTIME_URL` = `<your_railway_url>` (e.g., `https://concept-karaoke-realtime.up.railway.app`)

### 4. Verify Local Setup
Check your local `.env` file has:
```env
REALTIME_BROADCAST_SECRET=your_secret_here
REALTIME_SHARED_SECRET=your_jwt_secret_here
NEXT_PUBLIC_REALTIME_URL=http://localhost:8080
```

And `services/realtime-server/.env` has:
```env
REALTIME_BROADCAST_SECRET=your_secret_here
REALTIME_SHARED_SECRET=your_jwt_secret_here
```

### 5. Redeploy
Both Railway and Vercel should automatically redeploy when you add environment variables.

## What This Secret Does
- **REALTIME_BROADCAST_SECRET**: Authenticates HTTP broadcast requests from Next.js API routes to the WebSocket server
- **REALTIME_SHARED_SECRET**: Used to sign JWT tokens for WebSocket client connections

Without these, API routes can't notify the WebSocket server about:
- Brief generation completion
- Player ready state changes
- Phase transitions
- Game status updates

## Testing After Fix
1. Start a game
2. Check Railway logs - should see successful broadcast messages instead of `broadcast_no_secret_configured`
3. Check Vercel logs - should see detailed brief generation logs like:
   ```
   [Game Start] Starting brief generation...
   [generateBrief] Starting. Category: All Style: wacky
   [generateBrief] Calling Gemini API...
   [generateBrief] Successfully generated: <Product Name>
   ```
4. Brief should generate and display properly
