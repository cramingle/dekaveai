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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const brandProfile = JSON.parse(result);

    return NextResponse.json(brandProfile);
  } catch (error) {
    console.error('Error analyzing brand:', error);
    return NextResponse.json(
      { error: 'Failed to analyze brand' },
      { status: 500 }
    );
  }
} 