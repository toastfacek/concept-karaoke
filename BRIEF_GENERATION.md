# Brief Generation System

## Overview

The brief generation system creates creative advertising briefs for fictional products using AI. These briefs serve as the foundation for the collaborative game where players create campaigns.

---

## Current Implementation

### API Endpoint
**File**: `app/api/briefs/generate/route.ts`

**Endpoint**: `POST /api/briefs/generate`

**Request Body**:
```json
{
  "roomId": "uuid-string"
}
```

**Response**:
```json
{
  "success": true,
  "brief": {
    "productName": "string",
    "productCategory": "string",
    "businessProblem": "string",
    "targetAudience": "string",
    "objective": "string"
  }
}
```

---

## AI Model Configuration

### Current Model: Gemini 2.5 Flash

**Model**: `gemini-2.5-flash`
**Provider**: Google Generative AI
**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

**Generation Config**:
- **Temperature**: `0.7` - Balanced creativity and coherence
- **Response MIME Type**: `application/json` - Forces JSON output
- **API Key**: From `GEMINI_API_KEY` environment variable

---

## Prompt Structure

The prompt is constructed as a multi-line string with specific instructions:

```typescript
const prompt = [
  `Generate a creative advertising brief for a fictional product in the "${productCategory}" category.`,
  "Respond with valid JSON that matches this TypeScript interface:",
  "{",
  '  "productName": string,',
  '  "productCategory": string,',
  '  "businessProblem": string,',
  '  "targetAudience": string,',
  '  "objective": string',
  "}",
  `The productCategory field MUST be exactly: "${productCategory}"`,
  "Make the productName creative and fitting for this category.",
  "Keep it playful but useful for a collaborative improv game.",
  "Do not wrap the JSON in markdown fences or add extra text.",
].join("\n")
```

### Prompt Breakdown

1. **Task Definition**: "Generate a creative advertising brief..."
   - Sets the creative context
   - Specifies it's for a fictional product
   - Constrains to the selected category

2. **Schema Definition**: "Respond with valid JSON..."
   - Explicitly defines the expected output structure
   - Uses TypeScript interface notation for clarity
   - Lists all required fields

3. **Category Constraint**: "The productCategory field MUST be exactly..."
   - Enforces exact category match
   - Prevents model hallucination of categories

4. **Creative Guidelines**:
   - "Make the productName creative and fitting" - Encourages originality
   - "Keep it playful but useful" - Balances fun with functionality
   - Aligns with the game's improv nature

5. **Format Constraint**: "Do not wrap the JSON..."
   - Prevents markdown code fences (```json)
   - Ensures clean JSON parsing
   - Reduces post-processing needs

---

## Category Handling

### Product Categories

Categories are defined in `lib/types.ts`:

```typescript
export const PRODUCT_CATEGORIES = [
  "All",
  "Consumer Electronics",
  "Food & Beverage",
  "Fashion & Apparel",
  // ... more categories
] as const
```

### "All" Category Logic

When "All" is selected:
1. System randomly picks from `SPECIFIC_PRODUCT_CATEGORIES` (excludes "All")
2. Ensures variety across games
3. Prevents generic/unfocused briefs

```typescript
const productCategory = selectedCategory === "All"
  ? SPECIFIC_PRODUCT_CATEGORIES[Math.floor(Math.random() * SPECIFIC_PRODUCT_CATEGORIES.length)]
  : selectedCategory
```

---

## Response Processing

### 1. API Call

```typescript
const completionResponse = await fetch(`${GEMINI_GENERATE_URL}?key=${geminiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  }),
})
```

### 2. Content Extraction

```typescript
const textContent = completionPayload?.candidates?.[0]?.content?.parts?.[0]?.text
if (typeof textContent !== "string") {
  throw new Error("Unexpected Gemini response format")
}
```

Navigates Gemini's nested response structure:
- `candidates[0]` - First generation candidate
- `content.parts[0]` - First content part
- `text` - The actual JSON string

### 3. Validation

```typescript
const parsedBrief = briefSchema.parse(JSON.parse(textContent))
```

Two-stage validation:
1. **JSON.parse()** - Ensures valid JSON syntax
2. **briefSchema.parse()** - Validates structure and field types using Zod

**Schema Definition**:
```typescript
const briefSchema = z.object({
  productName: z.string().min(1),
  productCategory: z.string().min(1),
  businessProblem: z.string().min(1),
  targetAudience: z.string().min(1),
  objective: z.string().min(1),
})
```

### 4. Database Persistence

```typescript
// Update existing brief or insert new one
if (existing) {
  await supabase.from(TABLES.campaignBriefs).update({
    product_name: parsedBrief.productName,
    product_category: parsedBrief.productCategory,
    business_problem: parsedBrief.businessProblem,
    target_audience: parsedBrief.targetAudience,
    objective: parsedBrief.objective,
  }).eq("id", existing.id)
} else {
  await supabase.from(TABLES.campaignBriefs).insert({
    room_id: parsed.data.roomId,
    // ... fields
  })
}
```

---

## Testing Suite

### New Test Page
**File**: `app/test-briefs/page.tsx`

A dedicated testing interface for comparing different AI models.

**Features**:
- Category selection
- Model provider selection (Gemini, GPT-4o, Claude)
- Generation time tracking
- Side-by-side brief comparison
- Real-time brief editing

### Supported Models

1. **Gemini 2.5 Flash** (Current Production)
   - Fast, cost-effective
   - Native JSON mode
   - Good creative balance

2. **Gemini 2.0 Flash Exp** (Experimental)
   - Newer model iteration
   - Testing for quality improvements

3. **GPT-4o** (OpenAI)
   - High-quality outputs
   - JSON mode support
   - Comparison baseline

4. **Claude 3.5 Sonnet** (Anthropic)
   - Strong reasoning capabilities
   - Verbose, detailed outputs
   - Alternative perspective

---

## Quality Evaluation Criteria

### Content Quality
1. **Product Name**
   - Creativity and originality
   - Category appropriateness
   - Memorability
   - Playfulness

2. **Business Problem**
   - Clarity and specificity
   - Realism within fictional context
   - Actionable framing
   - Complexity level for gameplay

3. **Target Audience**
   - Specificity (not "everyone")
   - Demographic/psychographic details
   - Helps guide creative direction
   - Realistic segmentation

4. **Campaign Objective**
   - Clear, measurable outcome
   - Aligned with problem
   - Inspires creative solutions
   - Appropriate scope

### Technical Metrics
1. **Generation Time** - Speed of response (ms)
2. **JSON Validity** - Parsing success rate
3. **Schema Compliance** - All fields present and valid
4. **Category Accuracy** - Matches requested category
5. **Token Efficiency** - Tokens used per generation

---

## Known Issues & Considerations

### Current Challenges

1. **Category Drift**
   - Sometimes model interprets category loosely
   - Example: "Tech" product in "Consumer Electronics"
   - Mitigated by explicit constraint in prompt

2. **Verbose Responses**
   - Some models add explanatory text
   - Can break JSON parsing
   - Handled by "Do not wrap..." instruction

3. **Generic Outputs**
   - Occasional lack of creativity
   - More common with lower temperatures
   - Balanced by temperature=0.7 setting

4. **Field Length Variability**
   - Some briefs very short, others verbose
   - No explicit length constraints in prompt
   - Could add character count guidelines

### Future Improvements

1. **Prompt Engineering**
   - Add examples (few-shot learning)
   - Specify desired field lengths
   - Add tone/style guidance
   - Test different instruction ordering

2. **Multi-Model Strategy**
   - Use different models for different categories
   - Ensemble voting for quality
   - Fallback chain for reliability

3. **Quality Scoring**
   - Automated brief quality assessment
   - Reject and regenerate low-quality outputs
   - Track quality metrics over time

4. **Caching**
   - Cache high-quality briefs by category
   - Reduce API costs
   - Faster brief delivery

5. **User Feedback Loop**
   - Allow players to rate brief quality
   - Train on preferred styles
   - Identify problematic patterns

---

## Environment Variables

Required for brief generation:

```bash
# Current (Required)
GEMINI_API_KEY=your_gemini_key

# Testing Suite (Optional)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

---

## Usage in Game Flow

1. **Lobby Phase**: Host starts game
2. **Brief Generation**: Triggered automatically or via "Generate Brief" button
3. **Brief Review**: Players review and optionally edit brief
4. **Lock Brief**: Players confirm they're ready
5. **Creation Begins**: Brief guides creative phases

---

## Cost Considerations

### Current Costs (Gemini 2.5 Flash)
- **Input**: ~$0.000125 per 1K tokens
- **Output**: ~$0.0005 per 1K tokens
- **Typical Brief**: ~200 input + 150 output tokens
- **Cost per brief**: ~$0.0001 (negligible)

### Alternative Models
- **GPT-4o**: ~10-20x more expensive
- **Claude 3.5 Sonnet**: ~15-25x more expensive
- **Gemini 2.0 Flash Exp**: Similar to 2.5 Flash

**Recommendation**: Continue with Gemini for production, use premium models for special cases or quality benchmarking.
