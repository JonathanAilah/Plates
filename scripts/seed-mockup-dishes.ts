// One-time seed script: creates 8 mockup cooks and their dishes with AI photos.
// Run with: npm run seed
//
// This version:
// - Creates 8 separate seller users, one per dish (matches marketplace premise)
// - Spreads them across the SF Bay Area with slightly different lat/lngs
//   so they show as distinct pins on the map
// - Idempotent: re-running skips dishes that already exist and backfills missing photos

import { neon } from '@neondatabase/serverless';
import { generateFoodImage } from '../lib/imageGen';

const sql = neon(
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  ''
);

// Base center: Fruitvale, Oakland CA — matches the design mockup neighborhood
const BASE_LAT = 37.7757;
const BASE_LNG = -122.2251;

interface SeedCook {
  cookName: string;
  kitchenName: string;
  email: string;
  avatar: string;
  bio: string;
  // Offsets in degrees (roughly ~0.01 = ~1km)
  latOffset: number;
  lngOffset: number;
  dishName: string;
  dishDescription: string;
  price: number;
  emoji: string;
}

const cooks: SeedCook[] = [
  { cookName: 'Marisol Vega', kitchenName: 'Marisol Handmade Pupusas', email: 'marisol.seed@plates.local', avatar: 'M', bio: 'Third-generation pupusa maker from Sonsonate.', latOffset: -0.008, lngOffset: -0.011, dishName: 'Marisol Handmade Pupusas', dishDescription: 'Thick corn masa stuffed with cheese and beans, griddled crisp. Served with tangy curtido slaw.', price: 10, emoji: 'flatbread' },
  { cookName: 'Rosa Martinez', kitchenName: 'Dona Rosa Kitchen', email: 'rosa.seed@plates.local', avatar: 'R', bio: 'Family recipe from Michoacan, four generations deep.', latOffset: 0.006, lngOffset: -0.009, dishName: 'Dona Rosa Birria Tacos', dishDescription: 'Slow-braised beef in guajillo consome, three corn tortillas, cilantro, onion, lime.', price: 12, emoji: 'taco' },
  { cookName: 'Kemi Adeyemi', kitchenName: 'Auntie Kemi Jollof House', email: 'kemi.seed@plates.local', avatar: 'K', bio: 'Cooking Lagos-style jollof for 20 years.', latOffset: 0.011, lngOffset: 0.004, dishName: 'Auntie Kemi Jollof', dishDescription: 'Smoky West African jollof rice with tomato, scotch bonnet, and grilled chicken. Family size.', price: 15, emoji: 'rice' },
  { cookName: 'Lucia Bianchi', kitchenName: 'Nonna Lucia Table', email: 'lucia.seed@plates.local', avatar: 'L', bio: 'Nonna since 1962. Handrolled pasta only.', latOffset: -0.004, lngOffset: 0.008, dishName: 'Nonna Lucia Sunday Bolognese', dishDescription: 'Six-hour beef and pork ragu over hand-rolled tagliatelle, finished with parmesan.', price: 14, emoji: 'pasta' },
  { cookName: 'Anh Nguyen', kitchenName: 'Anh Corner Bun Cha', email: 'anh.seed@plates.local', avatar: 'A', bio: 'Grew up on Hanoi street food.', latOffset: 0.003, lngOffset: 0.012, dishName: 'Anh Bun Cha', dishDescription: 'Grilled pork patties and belly in sweet-sour nuoc cham, cold rice noodles, fresh herbs.', price: 13, emoji: 'noodles' },
  { cookName: 'Yerlan Nurlan', kitchenName: 'Yerlan Steppe Kitchen', email: 'yerlan.seed@plates.local', avatar: 'Y', bio: 'Kazakh comfort food, slow-cooked.', latOffset: -0.012, lngOffset: 0.003, dishName: 'Yerlan Beef Kaurdak', dishDescription: 'Kazakh comfort stew: seared beef, potatoes, carrots, and onions slow-braised until tender.', price: 13, emoji: 'stew' },
  { cookName: 'Priya Kapoor', kitchenName: 'Priya Home Curry', email: 'priya.seed@plates.local', avatar: 'P', bio: 'North Indian home cooking, taught by my mother.', latOffset: 0.009, lngOffset: -0.006, dishName: 'Priya Butter Chicken', dishDescription: 'Charred tandoori chicken finished in a silky tomato-cashew gravy. Comes with basmati rice.', price: 13, emoji: 'curry' },
  { cookName: 'Joe Washington', kitchenName: 'Papa Joe Southern Sweets', email: 'joe.seed@plates.local', avatar: 'J', bio: 'Third-generation Southern baker.', latOffset: 0.014, lngOffset: 0.010, dishName: 'Papa Joe Peach Cobbler', dishDescription: 'Deep-South cobbler with sugared peaches, buttermilk biscuit topping, still warm from the oven.', price: 8, emoji: 'cake' },
];

async function ensureCook(cook: SeedCook): Promise<number> {
  const existing = await sql`SELECT id FROM users WHERE email = ${cook.email} LIMIT 1`;
  if (existing[0]) {
    // Update lat/lng in case we changed the offsets
    const lat = BASE_LAT + cook.latOffset;
    const lng = BASE_LNG + cook.lngOffset;
    await sql`UPDATE users SET latitude = ${lat}, longitude = ${lng}, kitchen_latitude = ${lat}, kitchen_longitude = ${lng}, kitchen_name = ${cook.kitchenName} WHERE id = ${existing[0].id}`;
    return existing[0].id;
  }

  const lat = BASE_LAT + cook.latOffset;
  const lng = BASE_LNG + cook.lngOffset;
  const created = await sql`
    INSERT INTO users (name, email, avatar, bio, is_seller, kitchen_name, cottage_food_attested, latitude, longitude, kitchen_latitude, kitchen_longitude)
    VALUES (${cook.cookName}, ${cook.email}, ${cook.avatar}, ${cook.bio}, true, ${cook.kitchenName}, true, ${lat}, ${lng}, ${lat}, ${lng})
    RETURNING id
  `;
  return created[0].id;
}

async function seed() {
  console.log('Seeding 8 mockup cooks + their dishes across the Bay Area...');

  // Clean up the old single "Neighborhood Kitchen" seed seller from previous script version.
  // Its dishes are location-less so they clutter the app. CASCADE deletes their dishes too.
  const oldSeed = await sql`SELECT id FROM users WHERE email = 'seed-mockup@plates.local' LIMIT 1`;
  if (oldSeed[0]) {
    console.log('Removing old single-seller seed data...');
    await sql`DELETE FROM users WHERE id = ${oldSeed[0].id}`;
    console.log('  removed.');
  }

  let created = 0;
  let backfilled = 0;
  let skipped = 0;
  let failed = 0;

  for (const cook of cooks) {
    console.log('');
    console.log('Cook: ' + cook.cookName);
    const sellerId = await ensureCook(cook);

    // Look up dish; may already exist from an earlier run
    const existingDish = await sql`SELECT id, photo_url FROM dishes WHERE seller_id = ${sellerId} AND name = ${cook.dishName} LIMIT 1`;

    if (existingDish[0]) {
      if (existingDish[0].photo_url) {
        console.log('  skip (dish + photo already exist): ' + cook.dishName);
        skipped++;
        continue;
      }
      console.log('  backfilling photo for: ' + cook.dishName);
      try {
        const img = await generateFoodImage(cook.dishName);
        await sql`UPDATE dishes SET photo_url = ${img.url} WHERE id = ${existingDish[0].id}`;
        console.log('    image generated (~' + Math.round(img.bytes / 1024) + 'KB)');
        backfilled++;
      } catch (err) {
        console.error('    image failed: ' + (err instanceof Error ? err.message : err));
        failed++;
      }
      continue;
    }

    console.log('  creating dish: ' + cook.dishName);
    let photoDataUrl: string | null = null;
    try {
      const img = await generateFoodImage(cook.dishName);
      photoDataUrl = img.url;
      console.log('    image generated (~' + Math.round(img.bytes / 1024) + 'KB)');
    } catch (err) {
      console.error('    image failed: ' + (err instanceof Error ? err.message : err));
      failed++;
    }

    await sql`
      INSERT INTO dishes (seller_id, name, description, price, emoji, photo_url)
      VALUES (${sellerId}, ${cook.dishName}, ${cook.dishDescription}, ${cook.price}, ${cook.emoji}, ${photoDataUrl})
    `;
    created++;
    console.log('    dish inserted');
  }

  console.log('---');
  console.log('Done. Created ' + created + ', backfilled ' + backfilled + ', skipped ' + skipped + ', image failures ' + failed + '.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
