// One-time seed script: creates 8 mockup dishes with AI-generated photos.
// Run with: npm run seed

import { neon } from '@neondatabase/serverless';
import { generateFoodImage } from '../lib/imageGen';

const SEED_SELLER_EMAIL = 'seed-mockup@plates.local';

const sql = neon(
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  ''
);

interface SeedDish {
  name: string;
  description: string;
  price: number;
  emoji: string;
}

const dishes: SeedDish[] = [
  { name: 'Marisols Handmade Pupusas', description: 'Thick corn masa stuffed with cheese and beans, griddled crisp. Served with tangy curtido slaw.', price: 10, emoji: 'flatbread' },
  { name: 'Dona Rosa Birria Tacos', description: 'Slow-braised beef in guajillo consome, three corn tortillas, cilantro, onion, lime.', price: 12, emoji: 'taco' },
  { name: 'Auntie Kemi Jollof', description: 'Smoky West African jollof rice with tomato, scotch bonnet, and grilled chicken. Family size.', price: 15, emoji: 'rice' },
  { name: 'Nonna Lucia Sunday Bolognese', description: 'Six-hour beef and pork ragu over hand-rolled tagliatelle, finished with parmesan.', price: 14, emoji: 'pasta' },
  { name: 'Anh Bun Cha', description: 'Grilled pork patties and belly in sweet-sour nuoc cham, cold rice noodles, fresh herbs.', price: 13, emoji: 'noodles' },
  { name: 'Yerlan Beef Kaurdak', description: 'Kazakh comfort stew: seared beef, potatoes, carrots, and onions slow-braised until tender.', price: 13, emoji: 'stew' },
  { name: 'Priya Butter Chicken', description: 'Charred tandoori chicken finished in a silky tomato-cashew gravy. Comes with basmati rice.', price: 13, emoji: 'curry' },
  { name: 'Papa Joe Peach Cobbler', description: 'Deep-South cobbler with sugared peaches, buttermilk biscuit topping, still warm from the oven.', price: 8, emoji: 'cake' },
];

async function ensureSeedSeller(): Promise<number> {
  const existing = await sql`SELECT id FROM users WHERE email = ${SEED_SELLER_EMAIL} LIMIT 1`;
  if (existing[0]) return existing[0].id;

  const created = await sql`
    INSERT INTO users (name, email, avatar, bio, is_seller, kitchen_name, cottage_food_attested)
    VALUES ('Neighborhood Kitchen', ${SEED_SELLER_EMAIL}, 'N', 'A collection of neighborhood cooks', true, 'Neighborhood Kitchen', true)
    RETURNING id
  `;
  return created[0].id;
}

async function dishExists(sellerId: number, name: string): Promise<boolean> {
  const result = await sql`SELECT id FROM dishes WHERE seller_id = ${sellerId} AND name = ${name} LIMIT 1`;
  return result.length > 0;
}

async function seed() {
  console.log('Ensuring seed seller exists...');
  const sellerId = await ensureSeedSeller();
  console.log('  seller id = ' + sellerId);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const d of dishes) {
    const existingDish = await sql`SELECT id, photo_url FROM dishes WHERE seller_id = ${sellerId} AND name = ${d.name} LIMIT 1`;
    if (existingDish[0]) {
      if (existingDish[0].photo_url) {
        console.log('skip (has photo): ' + d.name);
        skipped++;
        continue;
      }
      console.log('backfilling photo for: ' + d.name);
      try {
        const img = await generateFoodImage(d.name);
        await sql`UPDATE dishes SET photo_url = ${img.dataUrl} WHERE id = ${existingDish[0].id}`;
        console.log('  image generated (~' + Math.round(img.bytes / 1024) + 'KB)');
        created++;
      } catch (err) {
        console.error('  image failed: ' + (err instanceof Error ? err.message : err));
        failed++;
      }
      continue;
    }

    console.log('generating photo for: ' + d.name);
    let photoDataUrl: string | null = null;
    try {
      const img = await generateFoodImage(d.name);
      photoDataUrl = img.dataUrl;
      console.log('  image generated (~' + Math.round(img.bytes / 1024) + 'KB)');
    } catch (err) {
      console.error('  image failed: ' + (err instanceof Error ? err.message : err));
      failed++;
    }

    await sql`
      INSERT INTO dishes (seller_id, name, description, price, emoji, photo_url)
      VALUES (${sellerId}, ${d.name}, ${d.description}, ${d.price}, ${d.emoji}, ${photoDataUrl})
    `;
    created++;
    console.log('  dish inserted');
  }

  console.log('---');
  console.log('Done. Created ' + created + ', skipped ' + skipped + ', image failures ' + failed + '.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});