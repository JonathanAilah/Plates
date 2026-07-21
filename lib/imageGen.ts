// Server-side utility for generating food photos via OpenAI GPT-Image-1.
// Never import this into client code (would leak the API key).

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
  dataUrl: string; // base64 data URL, JPEG
  bytes: number;
}

// Calls OpenAI GPT-Image-1 (the successor to DALL-E for image generation).
// Returns a base64 data URL suitable for storage in Postgres and rendering in <img>.
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

  const dataUrl = `data:image/jpeg;base64,${b64}`;
  return { dataUrl, bytes: Math.floor(b64.length * 0.75) };
}
