// One-time seed script: creates 8 mockup dishes with AI-generated photos.
// Run with: npm run seed
//
// Requires POSTGRES_URL and OPENAI_API_KEY in .env.local
// (Copy them from Vercel: `vercel env pull .env.local` or set manually.)
//
// This script:
// 1. Creates a "Mockup" seller user if it doesn't exist
// 2. Creates each dish only if it doesn't already exist (by name+seller)
// 3. Generates an AI photo for each new dish

import { config } from 'dotenv';
config({ path: '.env.local' });

import { sql } from '@vercel/postgres';
import { generateFoodImage } from '../lib/imageGen';

const SEED_SELLER_EMAIL = 'seed-mockup@plates.local';

interface SeedDish {
  name: string;
  description: string;
  price: number;
  emoji: string;
}

const dishes: SeedDish[] = [
  { name: "Marisol's Handmade Pupusas", description: 'Thick corn masa stuffed with cheese and beans, griddled crisp. Served with tangy curtido slaw.', price: 10, emoji: '🫓' },
  { name: "Doña Rosa's Birria Tacos", description: 'Slow-braised beef in guajillo consomé, three corn tortillas, cilantro, onion, lime. Family recipe from Michoacán.', price: 12, emoji: '🌮' },
  { name: "Auntie Kemi's Jollof", description: 'Smoky West African jollof rice with tomato, scotch bonnet, and grilled chicken. Family size.', price: 15, emoji: '🍚' },
  { name: 'Nonna Lucia\'s Sunday Bolognese', description: 'Six-hour beef and pork ragu over hand-rolled tagliatelle, finished with Parmigiano-Reggiano.', price: 14, emoji: '🍝' },
  { name: 'Anh\'s Bún Chả Hà Nội', description: 'Grilled pork patties and belly in sweet-sour nước chấm, cold rice noodles, fresh herbs.', price: 13, emoji: '🍜' },
  { name: 'Yerlan\'s Beef Kaurdak', description: 'Kazakh comfort stew: seared beef, potatoes, carrots, and onions slow-braised until tender.', price: 13, emoji: '🥘' },
  { name: 'Priya\'s Butter Chicken', description: 'Charred tandoori chicken finished in a silky tomato-cashew gravy. Comes with basmati rice.', price: 13, emoji: '🍛' },
  { name: 'Papa Joe\'s Peach Cobbler', description: 'Deep-South cobbler with sugared peaches, buttermilk biscuit topping, still warm from the oven.', price: 8, emoji: '🍰' },
];

async function ensureSeedSeller(): Promise<number> {
  const existing = await sql`SELECT id FROM users WHERE email = ${SEED_SELLER_EMAIL} LIMIT 1`;
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await sql`
    INSERT INTO users (name, email, avatar, bio, is_seller, kitchen_name, cottage_food_attested)
    VALUES ('Neighborhood Kitchen', ${SEED_SELLER_EMAIL}, 'N', 'A collection of neighborhood cooks', true, 'Neighborhood Kitchen', true)
    RETURNING id
  `;
  return created.rows[0].id;
}

async function dishExists(sellerId: number, name: string): Promise<boolean> {
  const result = await sql`SELECT id FROM dishes WHERE seller_id = ${sellerId} AND name = ${name} LIMIT 1`;
  return result.rows.length > 0;
}

async function seed() {
  console.log('→ Ensuring seed seller exists…');
  const sellerId = await ensureSeedSeller();
  console.log(`  seller id = ${sellerId}`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const d of dishes) {
    if (await dishExists(sellerId, d.name)) {
      console.log(`✓ skip (exists): ${d.name}`);
      skipped++;
      continue;
    }

    console.log(`→ generating photo for: ${d.name}`);
    let photoDataUrl: string | null = null;
    try {
      const img = await generateFoodImage(d.name);
      photoDataUrl = img.dataUrl;
      console.log(`  ✓ image generated (~${Math.round(img.bytes / 1024)}KB)`);
    } catch (err) {
      console.error(`  ✗ image failed: ${err instanceof Error ? err.message : err}`);
      failed++;
      // Continue and insert the dish without a photo; emoji fallback still works
    }

    await sql`
      INSERT INTO dishes (seller_id, name, description, price, emoji, photo_url)
      VALUES (${sellerId}, ${d.name}, ${d.description}, ${d.price}, ${d.emoji}, ${photoDataUrl})
    `;
    created++;
    console.log(`  ✓ dish inserted`);
  }

  console.log('---');
  console.log(`Done. Created ${created}, skipped ${skipped}, image failures ${failed}.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
