import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client on the server side
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60; // Set max duration to 60 seconds for Vercel
export const dynamic = 'force-dynamic'; // Disable static optimization

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { imageUrl, prompt } = await req.json();
    
    if (!imageUrl) {
      return new NextResponse(
        JSON.stringify({ error: 'Image URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Call OpenAI to analyze the brand image
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a brand identity expert who analyzes visual brand elements and extracts key characteristics. When creating JSON responses, use camelCase for field names (e.g., brandStyle, colorPalette), not snake_case."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this brand image and extract key brand elements. Focus on:
1. Overall brand style and aesthetic
2. Color palette (provide as array of color descriptions)
3. Key visual elements and symbols (provide as array)
4. Mood and tone
5. Target audience indicators
6. Industry category

Provide the analysis in a structured JSON format with these EXACT field names:
{
  "brandStyle": "string describing overall style",
  "colorPalette": ["array of colors"],
  "visualElements": ["array of elements"],
  "moodAndTone": "string describing mood",
  "targetAudience": "string describing audience",
  "industryCategory": "string describing industry"
}

It's critical to use these exact camelCase field names.`
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
      max_tokens: 500
    });
    
    // Parse and return the response with field name transformation
    const rawBrandProfile = JSON.parse(response.choices[0].message.content || "{}");
    
    // Transform snake_case field names to camelCase to match our interface
    const brandProfile = {
      brandStyle: rawBrandProfile.overall_brand_style_aesthetic || rawBrandProfile.brandStyle,
      colorPalette: rawBrandProfile.color_palette || rawBrandProfile.colorPalette || [],
      visualElements: rawBrandProfile.key_visual_elements_symbols || rawBrandProfile.visualElements || [],
      moodAndTone: rawBrandProfile.mood_tone || rawBrandProfile.moodAndTone,
      targetAudience: rawBrandProfile.target_audience_indicators || rawBrandProfile.targetAudience,
      industryCategory: rawBrandProfile.industry_category || rawBrandProfile.industryCategory
    };
    
    console.log('Mapped brand profile from AI response:', brandProfile);
    
    return new NextResponse(
      JSON.stringify(brandProfile),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in brand analysis:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        details: error instanceof Error ? error.stack : null
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 