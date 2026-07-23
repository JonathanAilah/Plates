// Server-side utility for generating food photos via OpenAI GPT-Image-1.
// Never import this into client code (would leak the API key).

import { put } from '@vercel/blob';

const PROMPT_TEMPLATE = (dishName: string) => {
  // Sanitize: strip anything that looks like prompt injection or role-shift attempts
  const clean = dishName
    .replace(/[\r\n]+/g, ' ')
    .replace(/["`]/g, '')
    .slice(0, 80)
    .trim();
  return `Overhead food photography of "${clean}", plated beautifully on a rustic ceramic plate, warm natural lighting, shallow depth of field, homemade appearance, appetizing, high detail, soft shadows.`;
};

export interface ImageGenResult {
  url: string; // Vercel Blob public URL (CDN-served, browser-cacheable)
  bytes: number;
}

// Calls OpenAI GPT-Image-1 (the successor to DALL-E for image generation),
// then stores the result in Vercel Blob and returns its public URL.
//
// Images are deliberately NOT returned as base64 data URLs: storing them
// inline in Postgres bloated the /api/dishes payload by hundreds of KB per
// dish, and data URLs can't be CDN-served, browser-cached, or lazy-loaded.
export async function generateFoodImage(dishName: string): Promise<ImageGenResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const prompt = PROMPT_TEMPLATE(dishName);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium', // 'low' | 'medium' | 'high' — medium is a good cost/quality balance
      output_format: 'jpeg',
      output_compression: 75,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`OpenAI API failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const json = await response.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data');

  const buffer = Buffer.from(b64, 'base64');

  const safeName =
    dishName
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'dish';

  const blob = await put(`plates/dishes/${safeName}.jpg`, buffer, {
    access: 'public',
    contentType: 'image/jpeg',
    addRandomSuffix: true,
  });

  return { url: blob.url, bytes: buffer.length };
}
