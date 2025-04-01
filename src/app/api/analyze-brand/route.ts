import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt } = await req.json();

    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
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
      // Parse the JSON response
      const brandProfile = JSON.parse(response.output_text);
      return NextResponse.json(brandProfile);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse brand analysis' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error analyzing brand:', error);
    return NextResponse.json(
      { error: 'Failed to analyze brand' },
      { status: 500 }
    );
  }
} 