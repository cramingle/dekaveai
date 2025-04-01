import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function extractJsonFromText(text: string): string {
  // Remove markdown code block syntax if present
  const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
  if (jsonMatch) {
    return jsonMatch[1];
  }
  
  // If no code block, try to find JSON object directly
  const objectMatch = text.match(/({[\s\S]*})/);
  if (objectMatch) {
    return objectMatch[1];
  }
  
  // If no JSON object found, return the original text
  return text;
}

export const maxDuration = 300; // Set max duration to 300 seconds (5 minutes)
export const dynamic = 'force-dynamic'; // Disable static optimization

export async function POST(req: Request) {
  try {
    // Add CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { headers });
    }

    const { imageUrl, prompt } = await req.json();

    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt + " Return ONLY the JSON object, no markdown or additional text." },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "high"
            },
          ],
        },
      ]
    });

    if (!response.output_text) {
      throw new Error('No response from OpenAI');
    }

    try {
      // Clean up the response text and extract JSON
      const cleanJson = extractJsonFromText(response.output_text);
      console.log('Cleaned JSON:', cleanJson); // Debug log
      
      // Parse the JSON response
      const brandProfile = JSON.parse(cleanJson);
      return NextResponse.json(brandProfile, { headers });
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Raw response:', response.output_text);
      return NextResponse.json(
        { 
          error: 'Failed to parse brand analysis',
          rawResponse: response.output_text // Include raw response for debugging
        },
        { status: 500, headers }
      );
    }
  } catch (error: any) {
    console.error('Error analyzing brand:', error);
    return NextResponse.json(
      { error: 'Failed to analyze brand' },
      { 
        status: error.status === 504 ? 504 : 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
} 