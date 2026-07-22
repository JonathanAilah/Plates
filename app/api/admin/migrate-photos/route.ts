import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';

// One-shot migration: converts any base64 data URLs in
// users.photo_url, dishes.photo_url, and posts.photo_url
// into Vercel Blob URLs.
//
// Admin only. Safe to re-run — only processes rows where
// photo_url still starts with 'data:'.
export async function POST() {
  try {
    await requireAdmin();

    const results: Array<{ table: string; id: string | number; status: 'migrated' | 'failed' | 'skipped'; detail?: string }> = [];

    // --- users ---
    const userRows = await sql`
      SELECT id, name, photo_url FROM users
      WHERE photo_url LIKE 'data:%'
    `;
    for (const row of userRows.rows) {
      results.push(await migrateOne('users', row.id, row.name || `user${row.id}`, row.photo_url));
    }

    // --- dishes ---
    const dishRows = await sql`
      SELECT id, name, photo_url FROM dishes
      WHERE photo_url LIKE 'data:%'
    `;
    for (const row of dishRows.rows) {
      results.push(await migrateOne('dishes', row.id, row.name || `dish${row.id}`, row.photo_url));
    }

    // --- posts (id is SERIAL integer) ---
    const postRows = await sql`
      SELECT id, photo_url FROM posts
      WHERE photo_url LIKE 'data:%'
    `;
    for (const row of postRows.rows) {
      results.push(await migrateOne('posts', row.id, `post_${row.id}`, row.photo_url));
    }

    const summary = {
      total: results.length,
      migrated: results.filter(r => r.status === 'migrated').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      details: results,
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('Photo migration error:', error);
    return NextResponse.json({ error: error?.message || 'Migration failed' }, { status: error?.status || 500 });
  }
}

async function migrateOne(
  table: string,
  id: string | number,
  label: string,
  base64Url: string,
  idIsUuid = false,
): Promise<{ table: string; id: string | number; status: 'migrated' | 'failed' | 'skipped'; detail?: string }> {
  try {
    const match = String(base64Url).match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!match) return { table, id, status: 'skipped', detail: 'Not a valid data URL' };

    const mime = match[1];
    const ext = mime.split('/')[1] || 'jpg';
    const buffer = Buffer.from(match[2], 'base64');
    const safeLabel = String(label).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);

    const blob = await put(
      `plates/migrated/${table}-${id}-${safeLabel}.${ext}`,
      buffer,
      { access: 'public', contentType: mime },
    );

    if (table === 'users') {
      await sql`UPDATE users SET photo_url = ${blob.url} WHERE id = ${id as number}`;
    } else if (table === 'dishes') {
      await sql`UPDATE dishes SET photo_url = ${blob.url} WHERE id = ${id as number}`;
    } else if (table === 'posts') {
      await sql`UPDATE posts SET photo_url = ${blob.url} WHERE id = ${id as number}`;
    }

    return { table, id, status: 'migrated', detail: blob.url };
  } catch (err) {
    return { table, id, status: 'failed', detail: err instanceof Error ? err.message : String(err) };
  }
}