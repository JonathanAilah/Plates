// One-time migration: move base64 data-URL photos out of Postgres and into
// Vercel Blob, replacing each photo_url with the Blob CDN URL.
//
// Run with: npm run migrate:photos
//
// Why: older dishes stored their AI-generated image inline as a
// `data:image/jpeg;base64,...` string in the photo_url column. That bloated
// the /api/dishes payload by hundreds of KB per dish and could not be
// CDN-served, browser-cached, or lazy-loaded. This backfills existing rows to
// match the new Blob-URL behavior. Idempotent: rows already on http(s) URLs
// are skipped, so it's safe to re-run.

import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

const sql = neon(
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  ''
);

interface Row {
  id: number;
  photo_url: string | null;
}

async function migrateRows(
  label: string,
  rows: Row[],
  update: (id: number, url: string) => Promise<unknown>
) {
  let migrated = 0, failed = 0, skipped = 0;
  for (const row of rows) {
    const url = row.photo_url;
    if (!url || !url.startsWith('data:')) { skipped++; continue; }

    const match = url.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i);
    if (!match) {
      console.warn(`  ${label} #${row.id}: unrecognized data URL, skipping`);
      failed++;
      continue;
    }

    try {
      const contentType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
      const blob = await put(`plates/migrated/${label}-${row.id}.${ext}`, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: true,
      });
      await update(row.id, blob.url);
      console.log(`  ${label} #${row.id}: migrated (${Math.round(buffer.length / 1024)}KB) -> ${blob.url}`);
      migrated++;
    } catch (err) {
      console.error(`  ${label} #${row.id}: FAILED — ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }
  console.log(`${label}: migrated ${migrated}, failed ${failed}, skipped ${skipped}`);
  return { migrated, failed, skipped };
}

async function main() {
  console.log('Scanning for base64 data-URL photos to migrate...');

  const dishes = (await sql`SELECT id, photo_url FROM dishes WHERE photo_url LIKE 'data:%'`) as Row[];
  await migrateRows('dish', dishes, (id, u) => sql`UPDATE dishes SET photo_url = ${u} WHERE id = ${id}`);

  // Defensive: user avatars and community posts should already be Blob URLs
  // (they upload via /api/upload), but migrate any stragglers too.
  const users = (await sql`SELECT id, photo_url FROM users WHERE photo_url LIKE 'data:%'`) as Row[];
  await migrateRows('user', users, (id, u) => sql`UPDATE users SET photo_url = ${u} WHERE id = ${id}`);

  const posts = (await sql`SELECT id, photo_url FROM posts WHERE photo_url LIKE 'data:%'`) as Row[];
  await migrateRows('post', posts, (id, u) => sql`UPDATE posts SET photo_url = ${u} WHERE id = ${id}`);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
