import { sql } from '@vercel/postgres';
import { PLATES_FEE_PERCENT } from './fees';
import { sidePriceFor } from './sides';

// Memoized so the schema migration runs at most once per server instance
// rather than on every request. On failure the cached promise is cleared so
// a later call can retry.
let migrationPromise: Promise<void> | null = null;

export function initializeDatabase(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigrations().catch((err) => {
      migrationPromise = null;
      throw err;
    });
  }
  return migrationPromise;
}

async function runMigrations(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        avatar VARCHAR(2) NOT NULL,
        bio TEXT,
        photo_url TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        is_seller BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS prep_address TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_name TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS kitchen_name TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cottage_food_attested BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_permit BOOLEAN`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS permit_number TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS kitchen_flags TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS kitchen_environment TEXT`;
    // Kitchen coordinates (geocoded from the prep address) are separate from
    // latitude/longitude, which is the user's LIVE location refreshed each
    // visit. They used to share one pair of columns, so a cook's blue dot was
    // pinned to their kitchen forever. Backfill: any seller with a prep
    // address had their kitchen coords stored in latitude/longitude.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS kitchen_latitude DOUBLE PRECISION`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS kitchen_longitude DOUBLE PRECISION`;
    // Live-location opt-out. When false, the stored coords are cleared and
    // updateUserLocation refuses new writes until the user re-shares.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location_sharing BOOLEAN DEFAULT true`;

    // In-app bug reports (Profile -> Report a bug; triaged in Admin)
    await sql`
      CREATE TABLE IF NOT EXISTS bug_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        body TEXT NOT NULL,
        screen TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status, created_at DESC)`;
    await sql`
      UPDATE users SET kitchen_latitude = latitude, kitchen_longitude = longitude
      WHERE prep_address IS NOT NULL AND kitchen_latitude IS NULL AND latitude IS NOT NULL
    `;
    // Cook-defined pickup time bounds (in minutes). Buyers choose within [min, max].
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pickup_min_minutes INTEGER`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pickup_max_minutes INTEGER`;
    // Terms acceptance tracking
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cooking_hours TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pickup_description TEXT`;
    // Auth columns
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id)`;
    // Seller approval workflow
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_status TEXT DEFAULT 'not_seller'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_disabled BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT`;
    // Stripe Connect (cooks)
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT false`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_stripe_account ON users(stripe_account_id)`;

    // Stripe payments (orders)
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(stripe_payment_intent_id)`;
    // Accounting: fee breakdown per order (stored at checkout so historical
    // orders keep original numbers even if the fee rate changes later)
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2)`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cook_earnings DECIMAL(10, 2)`;
    // Backfill orders placed before checkoutCart actually computed this split
    // (it declared these columns but never wrote them). Safe to re-run: only
    // touches rows still missing a value.
    await sql`
      UPDATE orders
      SET platform_fee = ROUND(total_price * ${PLATES_FEE_PERCENT}, 2),
          cook_earnings = total_price - ROUND(total_price * ${PLATES_FEE_PERCENT}, 2)
      WHERE platform_fee IS NULL
    `;
    // Backfill: any user who is currently is_seller=true should be treated as approved
    await sql`UPDATE users SET seller_status = 'approved' WHERE is_seller = true AND seller_status = 'not_seller'`;

    await sql`
      CREATE TABLE IF NOT EXISTS dishes (
        id SERIAL PRIMARY KEY,
        seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        emoji VARCHAR(10) NOT NULL,
        photo_url TEXT,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS photo_url TEXT`;
    // Catering items live on the cook's catering page only (never in the
    // homepage feed) and are picked up on a buyer-scheduled future date.
    await sql`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS is_catering BOOLEAN DEFAULT false`;
    // Dish extras: optional side options (comma-separated) and a daily
    // selling window (HH:MM, 24h) within the cook's stated cooking hours.
    await sql`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS sides TEXT`;
    await sql`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS sell_start TEXT`;
    await sql`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS sell_end TEXT`;
    // Buyer's chosen side rides the cart item and is snapshotted on the order
    await sql`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS side_choice TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS side_choice TEXT`;

    // Escrow model: buyer payments land in the platform's Stripe account;
    // the cook's share is a balance in Plates until they withdraw it.
    // - tip_amount: the buyer's tip, recorded on the first order row of the
    //   checkout (matching how it was charged); credited to the cook.
    // - escrowed: true for orders charged under the escrow model. Older
    //   orders were paid straight through to cooks by Stripe at charge time,
    //   so they must never count toward a withdrawable balance.
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10, 2)`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrowed BOOLEAN DEFAULT false`;
    // Service fee + tax charged at checkout, recorded on the first order row
    // of the batch (same pattern as tip_amount — that's the row whose payment
    // carried the extras). Older orders predate these columns and stay 0, so
    // admin tax/fee totals only reflect orders placed after this shipped.
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_fee DECIMAL(10, 2) DEFAULT 0`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0`;
    // Snapshot the seller directly on the order. Attribution used to go
    // through dishes (orders -> dishes -> seller), so deleting a dish
    // orphaned its orders: they vanished from order lists, kitchen queues,
    // and cook earnings while still counting in unjoined totals. seller_id
    // on the order makes the money trail survive dish deletion.
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_id INTEGER`;
    await sql`
      UPDATE orders SET seller_id = d.seller_id
      FROM dishes d
      WHERE orders.dish_id = d.id AND orders.seller_id IS NULL
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id)`;
    await sql`
      CREATE TABLE IF NOT EXISTS cook_withdrawals (
        id SERIAL PRIMARY KEY,
        cook_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'paid', 'failed')),
        stripe_transfer_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_withdrawals_cook ON cook_withdrawals(cook_id, created_at DESC)`;
    // Instant withdrawals: method ('standard' | 'instant' | 'instant_fallback')
    // and the convenience fee Plates kept for the instant option.
    await sql`ALTER TABLE cook_withdrawals ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'standard'`;
    await sql`ALTER TABLE cook_withdrawals ADD COLUMN IF NOT EXISTS fee DECIMAL(10, 2) DEFAULT 0`;

    await sql`
      CREATE TABLE IF NOT EXISTS dish_likes (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, dish_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'placed',
        pickup_code VARCHAR(4),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(4)`;
    // Migrate any legacy 'processing' status to the new 'placed'
    await sql`UPDATE orders SET status = 'placed' WHERE status = 'processing'`;

    await sql`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (buyer_id, dish_id)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_cart_buyer ON cart_items(buyer_id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id, created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS dish_reviews (
        id SERIAL PRIMARY KEY,
        dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
        buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (order_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_dish ON dish_reviews(dish_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_buyer ON dish_reviews(buyer_id)`;

    // Cached rating aggregates on dishes, so browsing/searching doesn't
    // re-aggregate the whole dish_reviews table on every request. A trigger
    // keeps these exact across inserts, edits, deletes, and cascade deletes.
    await sql`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS rating_sum INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0`;
    await sql`
      CREATE OR REPLACE FUNCTION plates_sync_dish_rating() RETURNS TRIGGER AS $$
      BEGIN
        IF (TG_OP = 'INSERT') THEN
          UPDATE dishes SET rating_sum = rating_sum + NEW.rating, rating_count = rating_count + 1
            WHERE id = NEW.dish_id;
        ELSIF (TG_OP = 'DELETE') THEN
          UPDATE dishes SET rating_sum = rating_sum - OLD.rating, rating_count = rating_count - 1
            WHERE id = OLD.dish_id;
        ELSIF (TG_OP = 'UPDATE') THEN
          IF (NEW.dish_id = OLD.dish_id) THEN
            UPDATE dishes SET rating_sum = rating_sum + (NEW.rating - OLD.rating)
              WHERE id = NEW.dish_id;
          ELSE
            UPDATE dishes SET rating_sum = rating_sum - OLD.rating, rating_count = rating_count - 1
              WHERE id = OLD.dish_id;
            UPDATE dishes SET rating_sum = rating_sum + NEW.rating, rating_count = rating_count + 1
              WHERE id = NEW.dish_id;
          END IF;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await sql`DROP TRIGGER IF EXISTS trg_sync_dish_rating ON dish_reviews`;
    await sql`
      CREATE TRIGGER trg_sync_dish_rating
      AFTER INSERT OR UPDATE OR DELETE ON dish_reviews
      FOR EACH ROW EXECUTE FUNCTION plates_sync_dish_rating()
    `;
    // Backfill from the source of truth (idempotent — recomputes to the same values).
    await sql`
      UPDATE dishes d SET
        rating_sum = COALESCE(s.sum, 0),
        rating_count = COALESCE(s.cnt, 0)
      FROM (
        SELECT dish_id, SUM(rating)::int AS sum, COUNT(*)::int AS cnt
        FROM dish_reviews GROUP BY dish_id
      ) s
      WHERE s.dish_id = d.id
        AND (d.rating_sum <> COALESCE(s.sum, 0) OR d.rating_count <> COALESCE(s.cnt, 0))
    `;

    // Community feed: ephemeral posts (24hr TTL)
    await sql`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
      )
    `;
    // Location snapshot columns (added later — safe re-run)
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`;
    await sql`CREATE INDEX IF NOT EXISTS idx_posts_expires ON posts(expires_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC)`;

    // Cook pickup hours: recurring weekly schedule per cook.
    // day_of_week: 0 = Sunday .. 6 = Saturday
    // start_time / end_time stored as HH:MM strings (24h) for simplicity
    // daily_capacity: how many orders the cook can fill that day total (null = unlimited)
    await sql`
      CREATE TABLE IF NOT EXISTS pickup_hours (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        daily_capacity INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, day_of_week)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pickup_hours_user ON pickup_hours(user_id)`;

    // Add pickup_slot column to orders — stores the buyer's chosen slot as HH:MM (or null for ASAP)
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_slot TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_date DATE`;
    // New: single timestamp for pickup time (replaces the slot+date approach)
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMP`;

    await sql`
      CREATE TABLE IF NOT EXISTS post_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS post_reactions (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('heart', 'fire', 'hands')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (post_id, user_id, kind)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions(post_id)`;

    await sql`CREATE INDEX IF NOT EXISTS idx_dishes_seller_id ON dishes(seller_id)`;
    // Profile visibility controls per dish
    await sql`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS is_hidden_from_profile BOOLEAN DEFAULT false`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_dish_id ON orders(dish_id)`;

    // Platform-wide pricing knobs, editable from the admin dashboard.
    // Single row (id = 1); percent values are stored as percentages (5 = 5%).
    await sql`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
        service_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 5,
        service_fee_min DECIMAL(6, 2) NOT NULL DEFAULT 0.50,
        default_tip DECIMAL(6, 2) NOT NULL DEFAULT 3,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

    console.log('✓ Database initialized successfully');
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('✓ Database tables already exist');
    } else {
      console.error('Database initialization error:', error);
      throw error;
    }
  }
}

export async function createUser(name: string, email: string, avatar: string) {
  const result = await sql`
    INSERT INTO users (name, email, avatar, bio)
    VALUES (${name}, ${email}, ${avatar}, 'Food enthusiast')
    RETURNING *
  `;
  return result.rows[0];
}

export async function getUser(id: number) {
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;
  return result.rows[0];
}

export async function updateUserSeller(id: number, isSeller: boolean) {
  const result = await sql`
    UPDATE users SET is_seller = ${isSeller} WHERE id = ${id} RETURNING *
  `;
  return result.rows[0];
}

export async function updateUserLocation(id: number, latitude: number, longitude: number) {
  // No-op when the user has opted out of location sharing — the automatic
  // per-visit refresh must not silently re-share.
  const result = await sql`
    UPDATE users SET latitude = ${latitude}, longitude = ${longitude}
    WHERE id = ${id} AND location_sharing IS DISTINCT FROM false
    RETURNING *
  `;
  if (result.rows[0]) return result.rows[0];
  const unchanged = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return unchanged.rows[0];
}

// ============= BUG REPORTS =============

export async function createBugReport(userId: number, body: string, screen: string | null) {
  const trimmed = body.trim().slice(0, 2000);
  if (trimmed.length < 5) {
    const e: any = new Error('Tell us a little more — at least a sentence');
    e.status = 400;
    throw e;
  }
  const result = await sql`
    INSERT INTO bug_reports (user_id, body, screen)
    VALUES (${userId}, ${trimmed}, ${screen ? screen.slice(0, 50) : null})
    RETURNING *
  `;
  return result.rows[0];
}

export async function getBugReports(status: string | null = null) {
  const rows = status
    ? await sql`
        SELECT b.*, COALESCE(u.name, 'Deleted user') as reporter_name, u.email as reporter_email
        FROM bug_reports b LEFT JOIN users u ON u.id = b.user_id
        WHERE b.status = ${status}
        ORDER BY b.created_at DESC LIMIT 200`
    : await sql`
        SELECT b.*, COALESCE(u.name, 'Deleted user') as reporter_name, u.email as reporter_email
        FROM bug_reports b LEFT JOIN users u ON u.id = b.user_id
        ORDER BY b.created_at DESC LIMIT 200`;
  return rows.rows;
}

export async function setBugReportStatus(id: number, status: 'open' | 'resolved') {
  const result = await sql`
    UPDATE bug_reports SET status = ${status} WHERE id = ${id} RETURNING *
  `;
  return result.rows[0];
}

// Toggle live-location sharing. Turning it OFF also erases the stored
// coordinates; turning it ON just re-arms updateUserLocation (fresh coords
// arrive from the client's next capture).
export async function setLocationSharing(id: number, enabled: boolean) {
  const result = enabled
    ? await sql`UPDATE users SET location_sharing = true WHERE id = ${id} RETURNING *`
    : await sql`UPDATE users SET location_sharing = false, latitude = NULL, longitude = NULL WHERE id = ${id} RETURNING *`;
  return result.rows[0];
}

// The prep address sets the KITCHEN coordinates — where pickups happen —
// never the user's live location.
export async function updateUserAddress(id: number, address: string, latitude: number, longitude: number) {
  const result = await sql`
    UPDATE users SET prep_address = ${address}, kitchen_latitude = ${latitude}, kitchen_longitude = ${longitude}
    WHERE id = ${id} RETURNING *
  `;
  return result.rows[0];
}

export async function updateCookProfile(id: number, data: {
  legalName?: string | null;
  kitchenName?: string | null;
  cottageFoodAttested?: boolean;
  hasPermit?: boolean | null;
  permitNumber?: string | null;
  kitchenFlags?: string | null;
  kitchenEnvironment?: string | null;
  cookingHours?: string | null;
  pickupDescription?: string | null;
  pickupMinMinutes?: number | null;
  pickupMaxMinutes?: number | null;
}) {
  const result = await sql`
    UPDATE users SET
      legal_name = COALESCE(${data.legalName ?? null}, legal_name),
      kitchen_name = COALESCE(${data.kitchenName ?? null}, kitchen_name),
      cottage_food_attested = COALESCE(${data.cottageFoodAttested ?? null}, cottage_food_attested),
      has_permit = COALESCE(${data.hasPermit ?? null}, has_permit),
      permit_number = COALESCE(${data.permitNumber ?? null}, permit_number),
      kitchen_flags = COALESCE(${data.kitchenFlags ?? null}, kitchen_flags),
      kitchen_environment = COALESCE(${data.kitchenEnvironment ?? null}, kitchen_environment),
      cooking_hours = COALESCE(${data.cookingHours ?? null}, cooking_hours),
      pickup_description = COALESCE(${data.pickupDescription ?? null}, pickup_description),
      pickup_min_minutes = COALESCE(${data.pickupMinMinutes ?? null}, pickup_min_minutes),
      pickup_max_minutes = COALESCE(${data.pickupMaxMinutes ?? null}, pickup_max_minutes)
    WHERE id = ${id} RETURNING *
  `;
  return result.rows[0];
}

export async function updateUserProfile(id: number, name: string, bio: string, photoUrl: string | null) {
  const result = await sql`
    UPDATE users SET name = ${name}, bio = ${bio}, photo_url = ${photoUrl} WHERE id = ${id} RETURNING *
  `;
  return result.rows[0];
}

export async function getUserByClerkId(clerkUserId: string) {
  const result = await sql`SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`;
  return result.rows[0] || null;
}

export async function createUserFromClerk(clerkUserId: string, name: string, email: string, avatar: string) {
  const result = await sql`
    INSERT INTO users (clerk_user_id, name, email, avatar, bio)
    VALUES (${clerkUserId}, ${name}, ${email}, ${avatar}, 'Food enthusiast')
    ON CONFLICT (email) DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id
    RETURNING *
  `;
  return result.rows[0];
}

export async function isAdmin(userId: number): Promise<boolean> {
  const result = await sql`SELECT role FROM users WHERE id = ${userId} LIMIT 1`;
  return result.rows[0]?.role === 'admin';
}

export async function getUserRoleById(userId: number): Promise<string | null> {
  const result = await sql`SELECT role FROM users WHERE id = ${userId} LIMIT 1`;
  return result.rows[0]?.role ?? null;
}

// Customer-service staff who get a push notification when a bug report lands.
export async function getBugAlertRecipients() {
  const result = await sql`
    SELECT id FROM users WHERE role = 'support' AND account_disabled = false
  `;
  return result.rows as { id: number }[];
}

export async function createDish(
  sellerId: number,
  name: string,
  description: string,
  price: number,
  emoji: string,
  photoUrl: string | null,
  isCatering: boolean = false,
  sides: string | null = null,
  sellStart: string | null = null,
  sellEnd: string | null = null,
) {
  const result = await sql`
    INSERT INTO dishes (seller_id, name, description, price, emoji, photo_url, is_catering, sides, sell_start, sell_end)
    VALUES (${sellerId}, ${name}, ${description}, ${price}, ${emoji}, ${photoUrl}, ${isCatering}, ${sides}, ${sellStart}, ${sellEnd})
    RETURNING *
  `;
  return result.rows[0];
}

export interface GetDishesOptions {
  // When lat/lng/radiusMiles are all provided, only dishes from cooks within
  // that radius are returned. Otherwise all approved dishes are returned.
  lat?: number | null;
  lng?: number | null;
  radiusMiles?: number | null;
  // Free-text search across dish name and cook name/kitchen. When set, matching
  // happens in SQL across the whole catalog (not just a loaded page).
  search?: string | null;
  // Pagination. limit null = no limit (legacy behavior); offset defaults to 0.
  limit?: number | null;
  offset?: number | null;
}

export async function getDishes(opts: GetDishesOptions = {}) {
  const lat = opts.lat ?? null;
  const lng = opts.lng ?? null;
  const radiusMiles = opts.radiusMiles ?? null;
  const search = (opts.search ?? '').trim();
  const limit = opts.limit ?? null;
  const offset = opts.offset ?? 0;

  const hasLoc =
    Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusMiles);

  // Great-circle distance in miles. GREATEST/LEAST clamp the acos argument to
  // [-1, 1] to avoid NaN from floating-point rounding on near-identical points.
  const distanceExpr = `
    3959 * acos(GREATEST(-1, LEAST(1,
      cos(radians($1)) * cos(radians(COALESCE(u.kitchen_latitude, u.latitude))) * cos(radians(COALESCE(u.kitchen_longitude, u.longitude)) - radians($2))
      + sin(radians($1)) * sin(radians(COALESCE(u.kitchen_latitude, u.latitude)))
    )))`;

  const params: unknown[] = [];
  let distanceSelect = 'NULL::double precision';
  let locFilter = '';
  if (hasLoc) {
    params.push(lat, lng, radiusMiles); // $1, $2, $3
    distanceSelect = distanceExpr;
    locFilter = `
      AND COALESCE(u.kitchen_latitude, u.latitude) IS NOT NULL
      AND COALESCE(u.kitchen_longitude, u.longitude) IS NOT NULL
      AND (${distanceExpr}) <= $3`;
  }

  let searchClause = '';
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    searchClause = `AND (d.name ILIKE ${p} OR u.name ILIKE ${p} OR u.kitchen_name ILIKE ${p})`;
  }

  let text = `
    SELECT d.*, u.name as seller_name, u.avatar as seller_avatar, u.photo_url as seller_photo_url,
           COALESCE(u.kitchen_latitude, u.latitude) as seller_latitude,
           COALESCE(u.kitchen_longitude, u.longitude) as seller_longitude,
           u.kitchen_flags as seller_kitchen_flags,
           u.kitchen_environment as seller_kitchen_environment,
           u.pickup_description as seller_pickup_description,
           u.cooking_hours as seller_cooking_hours,
           u.pickup_min_minutes as seller_pickup_min_minutes,
           u.pickup_max_minutes as seller_pickup_max_minutes,
           COALESCE(ROUND(d.rating_sum::numeric / NULLIF(d.rating_count, 0), 1), 0) as avg_rating,
           d.rating_count as review_count,
           (${distanceSelect}) as distance_miles
    FROM dishes d
    JOIN users u ON d.seller_id = u.id
    WHERE u.seller_status = 'approved'
      AND u.account_disabled = false
      AND (d.is_catering IS DISTINCT FROM true)
      ${locFilter}
      ${searchClause}
    ORDER BY d.created_at DESC`;

  if (limit != null && Number.isFinite(limit)) {
    params.push(limit);
    text += ` LIMIT $${params.length}`;
  }
  if (offset && Number.isFinite(offset)) {
    params.push(offset);
    text += ` OFFSET $${params.length}`;
  }

  const result = await sql.query(text, params);
  return result.rows;
}

// Public dish lookup for the shareable /meal/[id] page: only returns dishes
// whose cook is approved and active (mirrors the marketplace rules).
export async function getDishPublic(id: number) {
  const result = await sql`
    SELECT d.id, d.name, d.description, d.price, d.emoji, d.photo_url,
           d.is_catering, d.sides, d.sell_start, d.sell_end, d.likes,
           COALESCE(ROUND(d.rating_sum::numeric / NULLIF(d.rating_count, 0), 1), 0) as avg_rating,
           d.rating_count as review_count,
           u.id as seller_id, u.name as seller_name, u.kitchen_name as seller_kitchen_name,
           u.avatar as seller_avatar, u.photo_url as seller_photo_url
    FROM dishes d
    JOIN users u ON d.seller_id = u.id
    WHERE d.id = ${id} AND u.seller_status = 'approved' AND u.account_disabled = false
    LIMIT 1
  `;
  return result.rows[0] || null;
}

export async function getDish(id: number) {
  const result = await sql`
    SELECT d.*, u.name as seller_name, u.avatar as seller_avatar, u.id as seller_id,
           u.photo_url as seller_photo_url,
           COALESCE(u.kitchen_latitude, u.latitude) as seller_latitude,
           COALESCE(u.kitchen_longitude, u.longitude) as seller_longitude,
           u.kitchen_flags as seller_kitchen_flags,
           u.kitchen_environment as seller_kitchen_environment,
           u.pickup_description as seller_pickup_description,
           u.cooking_hours as seller_cooking_hours,
           u.pickup_min_minutes as seller_pickup_min_minutes,
           u.pickup_max_minutes as seller_pickup_max_minutes,
           COALESCE(ROUND(d.rating_sum::numeric / NULLIF(d.rating_count, 0), 1), 0) as avg_rating,
           d.rating_count as review_count
    FROM dishes d
    JOIN users u ON d.seller_id = u.id
    WHERE d.id = ${id}
  `;
  return result.rows[0];
}

export async function getSellerDishes(sellerId: number) {
  const result = await sql`
    SELECT * FROM dishes WHERE seller_id = ${sellerId} ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function updateDishPrice(id: number, price: number) {
  const result = await sql`
    UPDATE dishes SET price = ${price} WHERE id = ${id} RETURNING *
  `;
  return result.rows[0];
}

export async function updateDishPhoto(id: number, photoUrl: string) {
  const result = await sql`
    UPDATE dishes SET photo_url = ${photoUrl} WHERE id = ${id} RETURNING *
  `;
  return result.rows[0];
}

// In-memory rate limiter for image generation. Not perfect for serverless
// (per-instance), but a reasonable second line of defense on top of
// server-side per-user checks. Prevents accidental double-clicks.
const genAttempts = new Map<number, number>();
const MIN_INTERVAL_MS = 10000;

export function checkGenRateLimit(userId: number): { allowed: boolean; retryInMs: number } {
  const now = Date.now();
  const last = genAttempts.get(userId) || 0;
  const elapsed = now - last;
  if (elapsed < MIN_INTERVAL_MS) return { allowed: false, retryInMs: MIN_INTERVAL_MS - elapsed };
  genAttempts.set(userId, now);
  return { allowed: true, retryInMs: 0 };
}

// For seed scripts and other server-side callers where rate limiting doesn't apply
export function clearGenRateLimit(userId: number) {
  genAttempts.delete(userId);
}

export async function deleteDish(id: number) {
  await sql`DELETE FROM dishes WHERE id = ${id}`;
  return { success: true };
}

export async function toggleLike(userId: number, dishId: number) {
  try {
    await sql`INSERT INTO dish_likes (user_id, dish_id) VALUES (${userId}, ${dishId})`;
    await sql`UPDATE dishes SET likes = likes + 1 WHERE id = ${dishId}`;
    return { liked: true };
  } catch {
    await sql`DELETE FROM dish_likes WHERE user_id = ${userId} AND dish_id = ${dishId}`;
    await sql`UPDATE dishes SET likes = GREATEST(0, likes - 1) WHERE id = ${dishId}`;
    return { liked: false };
  }
}

export async function isLiked(userId: number, dishId: number) {
  const result = await sql`
    SELECT * FROM dish_likes WHERE user_id = ${userId} AND dish_id = ${dishId}
  `;
  return result.rows.length > 0;
}

export async function createOrder(buyerId: number, dishId: number, quantity: number, totalPrice: number, pickupAt: string | null = null) {
  const result = await sql`
    INSERT INTO orders (buyer_id, dish_id, quantity, total_price, pickup_at)
    VALUES (${buyerId}, ${dishId}, ${quantity}, ${totalPrice}, ${pickupAt})
    RETURNING *
  `;
  return result.rows[0];
}

export async function getOrders(buyerId: number) {
  const result = await sql`
    SELECT o.id, o.buyer_id, o.dish_id, o.quantity, o.total_price, o.status, o.pickup_code,
           o.created_at, o.updated_at, o.pickup_at, o.side_choice,
           COALESCE(d.name, 'Deleted dish') as dish_name, COALESCE(d.emoji, '🍽️') as dish_emoji,
           d.photo_url as dish_photo_url, d.price as dish_price,
           u.id as seller_id, COALESCE(u.name, 'Deleted cook') as seller_name,
           COALESCE(u.avatar, '?') as seller_avatar,
           u.photo_url as seller_photo_url,
           COALESCE(u.kitchen_latitude, u.latitude) as seller_latitude,
           COALESCE(u.kitchen_longitude, u.longitude) as seller_longitude,
           u.prep_address as seller_address,
           u.kitchen_name as seller_kitchen_name,
           u.cooking_hours as seller_cooking_hours,
           u.pickup_description as seller_pickup_description
    FROM orders o
    LEFT JOIN dishes d ON o.dish_id = d.id
    LEFT JOIN users u ON u.id = o.seller_id
    WHERE o.buyer_id = ${buyerId}
    ORDER BY o.created_at DESC
  `;
  return result.rows;
}

export async function updateOrderStatus(orderId: string, status: string) {
  const result = await sql`
    UPDATE orders SET status = ${status}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${orderId}
    RETURNING *
  `;
  return result.rows[0];
}

// ============= CANCEL + REFUND =============
// Shared internal helper: refunds (if paid) then marks cancelled.
// Assumes authorization + status checks have already been done by the caller.
async function refundAndCancelOrder(orderId: string, currentPaymentIntentId: string | null) {
  // Issue full refund FIRST (before touching status)
  if (currentPaymentIntentId) {
    const { stripe } = await import('./stripe');
    await stripe.refunds.create({
      payment_intent: currentPaymentIntentId,
    });
  }
  // Only mark cancelled AFTER refund succeeds
  const result = await sql`
    UPDATE orders
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE id = ${orderId}
    RETURNING *
  `;
  return result.rows[0];
}

// ============= PUSH SUBSCRIPTIONS =============

// Save or update a cook's push subscription. Upserts on endpoint so
// re-enabling notifications doesn't create duplicate rows.
export async function savePushSubscription(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  const result = await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${userId}, ${endpoint}, ${p256dh}, ${auth})
    ON CONFLICT (endpoint)
    DO UPDATE SET user_id = ${userId}, p256dh = ${p256dh}, auth = ${auth}
    RETURNING *
  `;
  return result.rows[0];
}

// Get all active push subscriptions for a user (they may have more than
// one device/browser).
export async function getPushSubscriptions(userId: number) {
  const result = await sql`
    SELECT * FROM push_subscriptions WHERE user_id = ${userId}
  `;
  return result.rows;
}

// Remove a subscription — called when a cook disables notifications,
// or when a send fails because the subscription is no longer valid.
export async function deletePushSubscription(endpoint: string) {
  await sql`
    DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}
  `;
}

// Cook-initiated cancel: allowed at any active stage.
export async function cookCancelOrder(orderId: string, cookId: number) {
  const check = await sql`
    SELECT o.id, o.status, o.stripe_payment_intent_id, o.seller_id
    FROM orders o
    WHERE o.id = ${orderId}
    LIMIT 1
  `;
  const row = check.rows[0];
  if (!row) {
    const e: any = new Error('Order not found');
    e.status = 404;
    throw e;
  }
  if (row.seller_id !== cookId) {
    const e: any = new Error('Not your order');
    e.status = 403;
    throw e;
  }
  if (row.status === 'picked_up' || row.status === 'cancelled') {
    const e: any = new Error(`Cannot cancel an order that is ${row.status}`);
    e.status = 400;
    throw e;
  }
  return refundAndCancelOrder(orderId, row.stripe_payment_intent_id);
}

// Buyer-initiated cancel: allowed ONLY while still 'placed' (before cook accepts).
export async function buyerCancelOrder(orderId: string, buyerId: number) {
  const check = await sql`
    SELECT o.id, o.status, o.stripe_payment_intent_id, o.buyer_id
    FROM orders o
    WHERE o.id = ${orderId}
    LIMIT 1
  `;
  const row = check.rows[0];
  if (!row) {
    const e: any = new Error('Order not found');
    e.status = 404;
    throw e;
  }
  if (row.buyer_id !== buyerId) {
    const e: any = new Error('Not your order');
    e.status = 403;
    throw e;
  }
  if (row.status !== 'placed') {
    const e: any = new Error('Order can no longer be cancelled — the cook has already accepted it');
    e.status = 400;
    throw e;
  }
  return refundAndCancelOrder(orderId, row.stripe_payment_intent_id);
}
// ============= ADMIN: HARD DELETE USER =============
// Erases a user and all their non-financial data. Preserves the money trail
// (orders, Stripe IDs, fees) by snapshotting name/email/dish onto the order
// and nulling the FK. If the user is a seller with open orders, all open
// orders are refunded + cancelled BEFORE deletion.
//
// Returns the list of Vercel Blob URLs that need to be deleted from Blob
// storage; the caller handles Blob cleanup after this function returns,
// since Blob deletion isn't part of the DB transaction.
//
// Throws if the user doesn't exist, is the last admin, or if any refund fails.
export async function deleteUserCompletely(userId: number): Promise<{
  deletedUserEmail: string;
  blobUrlsToDelete: string[];
  refundedOrderCount: number;
  preservedOrderCount: number;
}> {
  // 1. Load user + safety checks
  const userRows = await sql`SELECT id, name, email, role, photo_url FROM users WHERE id = ${userId} LIMIT 1`;
  const user = userRows.rows[0];
  if (!user) {
    const e: any = new Error('User not found');
    e.status = 404;
    throw e;
  }
  if (user.role === 'admin') {
    const adminCount = await sql`SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin'`;
    if (adminCount.rows[0].c <= 1) {
      const e: any = new Error('Cannot delete the last admin');
      e.status = 400;
      throw e;
    }
  }

  // 2. If the user is a seller, refund + cancel every open order on their dishes.
  //    Open = anything not terminal (not cancelled, not picked_up).
  const openSellerOrders = await sql`
    SELECT o.id, o.stripe_payment_intent_id
    FROM orders o
    WHERE o.seller_id = ${userId}
      AND o.status NOT IN ('cancelled', 'picked_up')
  `;
  for (const row of openSellerOrders.rows) {
    await refundAndCancelOrder(row.id, row.stripe_payment_intent_id);
  }
  const refundedOrderCount = openSellerOrders.rows.length;

  // 3. Also refund the user's OWN open orders where they're the buyer
  //    (a rare case if they were both buyer + seller, but safe).
  const openBuyerOrders = await sql`
    SELECT id, stripe_payment_intent_id
    FROM orders
    WHERE buyer_id = ${userId}
      AND status NOT IN ('cancelled', 'picked_up')
  `;
  for (const row of openBuyerOrders.rows) {
    await refundAndCancelOrder(row.id, row.stripe_payment_intent_id);
  }
  const totalRefunded = refundedOrderCount + openBuyerOrders.rows.length;

  // 4. Orders are deliberately PRESERVED (the money trail: totals, platform
  //    fee, cook earnings, seller_id). No PII snapshots are written — after
  //    the user row is gone, every order list LEFT JOINs users/dishes and
  //    labels the missing party "Deleted user" / "Deleted cook".
  //    (This step previously wrote to snapshot columns that no migration
  //    ever created, so the whole delete crashed here and the user row
  //    survived — which is why deleted users could sign back in and find
  //    their old profile intact.)

  // 5. Collect Blob URLs we'll need to delete from storage AFTER db work.
  //    Three columns hold Blob URLs: users.photo_url, dishes.photo_url, posts.photo_url.
  const blobUrls: string[] = [];
  if (user.photo_url) blobUrls.push(user.photo_url);

  const dishPhotos = await sql`
    SELECT photo_url FROM dishes WHERE seller_id = ${userId} AND photo_url IS NOT NULL
  `;
  for (const row of dishPhotos.rows) blobUrls.push(row.photo_url);

  const postPhotos = await sql`
    SELECT photo_url FROM posts WHERE user_id = ${userId} AND photo_url IS NOT NULL
  `;
  for (const row of postPhotos.rows) blobUrls.push(row.photo_url);

  // 6. Delete dependent rows that we don't need to preserve.
  //    Order matters: children of dishes/posts before dishes/posts themselves.
  //    Skip 'orders' (money trail) and 'cook_withdrawals' (payout ledger —
  //    needed to reconcile the platform's Stripe balance even after the
  //    cook is gone).
  await sql`DELETE FROM dish_reviews  WHERE buyer_id = ${userId} OR dish_id IN (SELECT id FROM dishes WHERE seller_id = ${userId})`;
  await sql`DELETE FROM dish_likes    WHERE user_id  = ${userId} OR dish_id IN (SELECT id FROM dishes WHERE seller_id = ${userId})`;
  await sql`DELETE FROM cart_items    WHERE buyer_id = ${userId} OR dish_id IN (SELECT id FROM dishes WHERE seller_id = ${userId})`;
  await sql`DELETE FROM post_comments WHERE user_id  = ${userId} OR post_id IN (SELECT id FROM posts WHERE user_id  = ${userId})`;
  await sql`DELETE FROM post_reactions WHERE user_id = ${userId} OR post_id IN (SELECT id FROM posts WHERE user_id  = ${userId})`;
  await sql`DELETE FROM messages      WHERE sender_id = ${userId}`;
  await sql`DELETE FROM pickup_hours  WHERE user_id = ${userId}`;
  await sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`;
  await sql`DELETE FROM bug_reports  WHERE user_id = ${userId}`;

  // 7. Delete their dishes and posts. Their orders keep dangling dish ids;
  //    order lists LEFT JOIN dishes and label those rows "Deleted dish".
  await sql`DELETE FROM dishes WHERE seller_id = ${userId}`;
  await sql`DELETE FROM posts  WHERE user_id  = ${userId}`;

  // 8. Count the preserved money records for the response.
  const preservedCount = await sql`
    SELECT COUNT(*)::int AS c FROM orders
    WHERE buyer_id = ${userId} OR seller_id = ${userId}
  `;

  // 9. Finally, delete the user row itself. A fresh signup with the same
  //    email now creates a brand-new profile instead of reattaching to
  //    this one via createUserFromClerk's ON CONFLICT (email) clause.
  await sql`DELETE FROM users WHERE id = ${userId}`;

  return {
    deletedUserEmail: user.email,
    blobUrlsToDelete: blobUrls,
    refundedOrderCount: totalRefunded,
    preservedOrderCount: preservedCount.rows[0].c,
  };
}

export async function getSellerOrders(sellerId: number) {
  const result = await sql`
    SELECT o.id, o.buyer_id, o.dish_id, o.quantity, o.total_price, o.status, o.pickup_code,
           o.created_at, o.updated_at, o.pickup_at, o.side_choice,
           COALESCE(d.name, 'Deleted dish') as dish_name, COALESCE(d.emoji, '🍽️') as dish_emoji,
           d.photo_url as dish_photo_url,
           COALESCE(u.name, 'Deleted user') as buyer_name, COALESCE(u.avatar, '?') as buyer_avatar,
           u.photo_url as buyer_photo_url
    FROM orders o
    LEFT JOIN dishes d ON o.dish_id = d.id
    LEFT JOIN users u ON o.buyer_id = u.id
    WHERE o.seller_id = ${sellerId}
    ORDER BY o.created_at DESC
  `;
  return result.rows;
}

export async function getCart(buyerId: number) {
  const result = await sql`
    SELECT c.id as cart_item_id, c.quantity, c.side_choice, d.*,
           u.id as seller_id,
           u.name as seller_name, u.avatar as seller_avatar, u.photo_url as seller_photo_url,
           COALESCE(u.kitchen_latitude, u.latitude) as seller_latitude,
           COALESCE(u.kitchen_longitude, u.longitude) as seller_longitude,
           u.pickup_min_minutes as seller_pickup_min_minutes,
           u.pickup_max_minutes as seller_pickup_max_minutes
    FROM cart_items c
    JOIN dishes d ON c.dish_id = d.id
    JOIN users u ON d.seller_id = u.id
    WHERE c.buyer_id = ${buyerId}
    ORDER BY c.created_at ASC
  `;
  return result.rows;
}
// Cook earnings summary from orders (excludes cancelled).
// Cook earnings summary from orders (excludes cancelled).
export async function getCookEarnings(sellerId: number) {
  const summary = await sql`
    SELECT
      COALESCE(SUM(o.cook_earnings), 0) as total_earnings,
      COALESCE(SUM(o.total_price), 0) as total_sales,
      COALESCE(SUM(o.platform_fee), 0) as total_fees,
      COUNT(*)::int as order_count
    FROM orders o
    WHERE o.seller_id = ${sellerId}
      AND o.status != 'cancelled'
  `;
  const thisWeek = await sql`
    SELECT
      COALESCE(SUM(o.cook_earnings), 0) as total_earnings,
      COALESCE(SUM(o.total_price), 0) as total_sales,
      COUNT(*)::int as order_count
    FROM orders o
    WHERE o.seller_id = ${sellerId}
      AND o.status != 'cancelled'
      AND o.created_at >= DATE_TRUNC('week', CURRENT_DATE)
  `;
  const thisMonth = await sql`
    SELECT
      COALESCE(SUM(o.cook_earnings), 0) as total_earnings,
      COALESCE(SUM(o.total_price), 0) as total_sales,
      COUNT(*)::int as order_count
    FROM orders o
    WHERE o.seller_id = ${sellerId}
      AND o.status != 'cancelled'
      AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
  `;
  const recent = await sql`
    SELECT o.id, o.total_price, o.cook_earnings, o.platform_fee, o.status, o.created_at,
           COALESCE(d.name, 'Deleted dish') as dish_name, COALESCE(d.emoji, '🍽️') as dish_emoji
    FROM orders o
    LEFT JOIN dishes d ON o.dish_id = d.id
    WHERE o.seller_id = ${sellerId}
      AND o.status != 'cancelled'
    ORDER BY o.created_at DESC
    LIMIT 20
  `;
  return {
    summary: summary.rows[0],
    thisWeek: thisWeek.rows[0],
    thisMonth: thisMonth.rows[0],
    recent: recent.rows,
  };
}
// ============= COOK BALANCE & WITHDRAWALS (escrow) =============
// Buyer payments stay in the platform's Stripe account. Each escrowed order
// carries the cook's share (cook_earnings + tip); that share is "pending"
// while the order is active and becomes "available" once picked up. Available
// minus everything already withdrawn (or reserved for an in-flight
// withdrawal) is what the Withdraw Funds button can move.

export async function getCookBalance(cookId: number) {
  const earned = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN o.status = 'picked_up' THEN o.cook_earnings + COALESCE(o.tip_amount, 0) END), 0) AS released,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('picked_up', 'cancelled') THEN o.cook_earnings + COALESCE(o.tip_amount, 0) END), 0) AS pending
    FROM orders o
    WHERE o.seller_id = ${cookId} AND o.escrowed = true
  `;
  const withdrawn = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM cook_withdrawals
    WHERE cook_id = ${cookId} AND status IN ('processing', 'paid')
  `;
  const released = Number(earned.rows[0].released);
  const pending = Number(earned.rows[0].pending);
  const withdrawnTotal = Number(withdrawn.rows[0].total);
  return {
    available: Math.max(0, Math.round((released - withdrawnTotal) * 100) / 100),
    pending: Math.round(pending * 100) / 100,
    withdrawn: Math.round(withdrawnTotal * 100) / 100,
  };
}

export async function getCookWithdrawals(cookId: number, limit: number = 10) {
  const result = await sql`
    SELECT id, amount, status, stripe_transfer_id, created_at
    FROM cook_withdrawals
    WHERE cook_id = ${cookId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.rows;
}

// Atomically reserve a withdrawal: the row is only inserted if the amount
// still fits inside (released - already reserved/paid), all computed inside
// one statement — a double-tap can't reserve the same dollars twice.
export async function reserveWithdrawal(cookId: number, amount: number) {
  const result = await sql`
    INSERT INTO cook_withdrawals (cook_id, amount, status)
    SELECT ${cookId}, ${amount}, 'processing'
    WHERE ${amount} > 0 AND ${amount} <= (
      COALESCE((
        SELECT SUM(o.cook_earnings + COALESCE(o.tip_amount, 0))
        FROM orders o
        WHERE o.seller_id = ${cookId} AND o.escrowed = true AND o.status = 'picked_up'
      ), 0)
      -
      COALESCE((
        SELECT SUM(w.amount) FROM cook_withdrawals w
        WHERE w.cook_id = ${cookId} AND w.status IN ('processing', 'paid')
      ), 0)
    )
    RETURNING *
  `;
  return result.rows[0] || null;
}

export async function settleWithdrawal(
  id: number,
  status: 'paid' | 'failed',
  stripeTransferId: string | null,
  method: 'standard' | 'instant' | 'instant_fallback' = 'standard',
  fee: number = 0,
) {
  const result = await sql`
    UPDATE cook_withdrawals
    SET status = ${status}, stripe_transfer_id = ${stripeTransferId}, method = ${method}, fee = ${fee}
    WHERE id = ${id}
    RETURNING *
  `;
  return result.rows[0];
}

export async function addToCart(buyerId: number, dishId: number, quantity: number, sideChoice: string | null = null) {
  const result = await sql`
    INSERT INTO cart_items (buyer_id, dish_id, quantity, side_choice)
    VALUES (${buyerId}, ${dishId}, ${quantity}, ${sideChoice})
    ON CONFLICT (buyer_id, dish_id)
    DO UPDATE SET quantity = cart_items.quantity + ${quantity},
                  side_choice = COALESCE(${sideChoice}, cart_items.side_choice)
    RETURNING *
  `;
  return result.rows[0];
}

export async function updateCartItem(cartItemId: number, quantity: number) {
  if (quantity <= 0) {
    await sql`DELETE FROM cart_items WHERE id = ${cartItemId}`;
    return { deleted: true };
  }
  const result = await sql`
    UPDATE cart_items SET quantity = ${quantity} WHERE id = ${cartItemId} RETURNING *
  `;
  return result.rows[0];
}

export async function removeCartItem(cartItemId: number) {
  await sql`DELETE FROM cart_items WHERE id = ${cartItemId}`;
  return { success: true };
}

export async function clearCart(buyerId: number) {
  await sql`DELETE FROM cart_items WHERE buyer_id = ${buyerId}`;
  return { success: true };
}

export async function checkoutCart(
  buyerId: number,
  tipAmount: number,
  serviceFee: number,
  pickupAt: string | null = null,
  paymentIntentIds: string[] = [],
) {
  const items = await getCart(buyerId);
  if (items.length === 0) return { orders: [], total: 0 };
  const orders = [];
  let total = 0;
  // Single-cook carts: one payment intent covers the order. Store it on each row.
  const primaryIntentId = paymentIntentIds[0] || null;

  // Recompute the service fee and tax exactly as the Stripe charge did
  // (cents math on the full cart subtotal) and record them on the first
  // order row — the client's serviceFee argument is display-only.
  const settings = await getPlatformSettings();
  const cartSubtotalCents = items.reduce(
    (s: number, i: any) =>
      s + (Math.round(Number(i.price) * 100) + Math.round(sidePriceFor(i.sides, i.side_choice) * 100)) * i.quantity,
    0,
  );
  const serviceFeeAmount = Math.max(
    Math.round(settings.serviceFeeMin * 100),
    Math.round(cartSubtotalCents * settings.serviceFeePercent / 100),
  ) / 100;
  const taxAmount = Math.round(cartSubtotalCents * settings.taxPercent / 100) / 100;

  let first = true;
  for (const item of items) {
    // A chosen side adds its price to every plate in the line
    const unitPrice = Number(item.price) + sidePriceFor(item.sides, item.side_choice);
    const linePrice = Math.round(unitPrice * item.quantity * 100) / 100;
    total += linePrice;
    const pickupCode = String(Math.floor(1000 + Math.random() * 9000));
    // Record the platform/cook split at order time. Under the escrow model
    // the whole charge lands in the platform's Stripe account; these stored
    // numbers ARE the ledger that backs cook balances and withdrawals.
    const platformFee = Math.round(linePrice * PLATES_FEE_PERCENT * 100) / 100;
    const cookEarnings = Math.round((linePrice - platformFee) * 100) / 100;
    // The tip was charged once, on the first order's payment — record it
    // there so the cook's balance credits it exactly once.
    const tipForRow = first ? Math.round((Number(tipAmount) || 0) * 100) / 100 : 0;
    const feeForRow = first ? serviceFeeAmount : 0;
    const taxForRow = first ? taxAmount : 0;
    const order = await sql`
      INSERT INTO orders (buyer_id, dish_id, quantity, total_price, status, pickup_code, pickup_at, stripe_payment_intent_id, side_choice, platform_fee, cook_earnings, tip_amount, escrowed, seller_id, service_fee, tax_amount)
      VALUES (${buyerId}, ${item.id}, ${item.quantity}, ${linePrice}, 'placed', ${pickupCode}, ${pickupAt}, ${primaryIntentId}, ${item.side_choice ?? null}, ${platformFee}, ${cookEarnings}, ${tipForRow}, true, ${item.seller_id}, ${feeForRow}, ${taxForRow})
      RETURNING *
    `;
    orders.push(order.rows[0]);
    first = false;
  }
  await clearCart(buyerId);
  return { orders, total: total + tipAmount + serviceFeeAmount + taxAmount, subtotal: total, tip: tipAmount, fee: serviceFeeAmount, tax: taxAmount };
}

// ============= MESSAGES =============

// Verify a user is a party to an order (buyer or seller). Returns the order row or null.
export async function getOrderIfParticipant(orderId: string, userId: number) {
  const result = await sql`
    SELECT o.*
    FROM orders o
    WHERE o.id = ${orderId} AND (o.buyer_id = ${userId} OR o.seller_id = ${userId})
    LIMIT 1
  `;
  return result.rows[0] || null;
}

export async function getMessagesForOrder(orderId: string) {
  const result = await sql`
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.photo_url as sender_photo_url
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.order_id = ${orderId}
    ORDER BY m.created_at ASC
  `;
  return result.rows;
}

export async function sendMessage(orderId: string, senderId: number, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Empty message');
  if (trimmed.length > 1000) throw new Error('Message too long');
  const result = await sql`
    INSERT INTO messages (order_id, sender_id, body)
    VALUES (${orderId}, ${senderId}, ${trimmed})
    RETURNING *
  `;
  return result.rows[0];
}

export async function markMessagesRead(orderId: string, readerId: number) {
  // Mark messages read for anyone EXCEPT the reader
  await sql`
    UPDATE messages SET read_at = CURRENT_TIMESTAMP
    WHERE order_id = ${orderId} AND sender_id != ${readerId} AND read_at IS NULL
  `;
  return { success: true };
}

// Returns unread counts per order for a given user (either as buyer or seller)
export async function getUnreadCounts(userId: number) {
  const result = await sql`
    SELECT o.id as order_id, COUNT(m.id)::int as unread
    FROM orders o
    LEFT JOIN messages m ON m.order_id = o.id AND m.sender_id != ${userId} AND m.read_at IS NULL
    WHERE (o.buyer_id = ${userId} OR o.seller_id = ${userId})
      AND o.status NOT IN ('picked_up', 'cancelled')
    GROUP BY o.id
    HAVING COUNT(m.id) > 0
  `;
  return result.rows;
}

// ============= PLATFORM SETTINGS (admin-editable pricing) =============

export interface PlatformSettings {
  taxPercent: number;        // % of subtotal, collected by the platform
  serviceFeePercent: number; // % of subtotal, collected by the platform
  serviceFeeMin: number;     // $ floor for the service fee
  defaultTip: number;        // $ pre-filled tip (buyer can edit at checkout)
}

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  taxPercent: 0,
  serviceFeePercent: 5,
  serviceFeeMin: 0.5,
  defaultTip: 3,
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const result = await sql`
      SELECT tax_percent, service_fee_percent, service_fee_min, default_tip
      FROM platform_settings WHERE id = 1
    `;
    const row = result.rows[0];
    if (!row) return DEFAULT_PLATFORM_SETTINGS;
    return {
      taxPercent: Number(row.tax_percent),
      serviceFeePercent: Number(row.service_fee_percent),
      serviceFeeMin: Number(row.service_fee_min),
      defaultTip: Number(row.default_tip),
    };
  } catch {
    // Table may not exist yet on a fresh deploy before the migration runs.
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

function clampNum(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n * 100) / 100));
}

export async function updatePlatformSettings(input: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  const next: PlatformSettings = {
    taxPercent: clampNum(input.taxPercent, 0, 30, current.taxPercent),
    serviceFeePercent: clampNum(input.serviceFeePercent, 0, 30, current.serviceFeePercent),
    serviceFeeMin: clampNum(input.serviceFeeMin, 0, 10, current.serviceFeeMin),
    defaultTip: clampNum(input.defaultTip, 0, 50, current.defaultTip),
  };
  await sql`
    UPDATE platform_settings SET
      tax_percent = ${next.taxPercent},
      service_fee_percent = ${next.serviceFeePercent},
      service_fee_min = ${next.serviceFeeMin},
      default_tip = ${next.defaultTip},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `;
  return next;
}

// ============= SYNC (cheap change detectors for client polling) =============
// These return opaque version strings the client compares between polls.
// A changed version means "refetch the real data"; an unchanged one means
// the poll cost was a single tiny indexed aggregate instead of a full fetch.

// Orders currently in flight for this user (as buyer or cook). Used by the
// welcome fork to skip itself when the user is mid-order.
export async function getActiveOrdersCount(userId: number): Promise<number> {
  const result = await sql`
    SELECT COUNT(*)::int AS c FROM orders
    WHERE (buyer_id = ${userId} OR seller_id = ${userId})
      AND status NOT IN ('picked_up', 'cancelled')
  `;
  return result.rows[0].c;
}

export async function getOrdersVersion(userId: number): Promise<string> {
  const result = await sql`
    SELECT COUNT(*)::int AS count, COALESCE(MAX(o.updated_at)::text, '') AS latest
    FROM orders o
    WHERE o.buyer_id = ${userId} OR o.seller_id = ${userId}
  `;
  const row = result.rows[0];
  return `${row.count}:${row.latest}`;
}

export async function getMessagesVersion(orderId: string): Promise<string> {
  const result = await sql`
    SELECT COUNT(*)::int AS count, COALESCE(MAX(id), 0)::int AS latest
    FROM messages WHERE order_id = ${orderId}
  `;
  const row = result.rows[0];
  return `${row.count}:${row.latest}`;
}

export async function getPendingSellersCount(): Promise<number> {
  const result = await sql`
    SELECT COUNT(*)::int AS c FROM users
    WHERE seller_status = 'pending' AND account_disabled = false
  `;
  return result.rows[0].c;
}

// ============= ADMIN =============

export async function submitSellerForReview(userId: number) {
  const result = await sql`
    UPDATE users SET seller_status = 'pending', is_seller = true
    WHERE id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function approveSeller(userId: number) {
  const result = await sql`
    UPDATE users SET seller_status = 'approved', rejection_reason = NULL, suspended_reason = NULL
    WHERE id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function rejectSeller(userId: number, reason: string) {
  const result = await sql`
    UPDATE users SET seller_status = 'rejected', rejection_reason = ${reason}
    WHERE id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function suspendSeller(userId: number, reason: string) {
  const result = await sql`
    UPDATE users SET seller_status = 'suspended', suspended_reason = ${reason}
    WHERE id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function unsuspendSeller(userId: number) {
  const result = await sql`
    UPDATE users SET seller_status = 'approved', suspended_reason = NULL
    WHERE id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function setAccountDisabled(userId: number, disabled: boolean) {
  const result = await sql`
    UPDATE users SET account_disabled = ${disabled}
    WHERE id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function setUserRole(userId: number, role: 'user' | 'admin' | 'secondary_admin' | 'support') {
  const result = await sql`
    UPDATE users SET role = ${role}
    WHERE id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function getPendingSellers() {
  const result = await sql`
    SELECT id, name, email, avatar, photo_url, bio, prep_address,
           legal_name, kitchen_name, cottage_food_attested, has_permit, permit_number,
           kitchen_flags, cooking_hours, pickup_description, created_at
    FROM users
    WHERE seller_status = 'pending' AND account_disabled = false
    ORDER BY created_at ASC
  `;
  return result.rows;
}

export async function getAllUsersForAdmin(filter?: string, search?: string) {
  const q = search ? `%${search.toLowerCase()}%` : null;
  if (filter === 'pending') {
    const result = q
      ? await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE seller_status = 'pending' AND (LOWER(name) LIKE ${q} OR LOWER(email) LIKE ${q}) ORDER BY created_at DESC`
      : await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE seller_status = 'pending' ORDER BY created_at DESC`;
    return result.rows;
  }
  if (filter === 'sellers') {
    const result = q
      ? await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE seller_status = 'approved' AND (LOWER(name) LIKE ${q} OR LOWER(email) LIKE ${q}) ORDER BY created_at DESC`
      : await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE seller_status = 'approved' ORDER BY created_at DESC`;
    return result.rows;
  }
  if (filter === 'suspended') {
    const result = q
      ? await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE seller_status = 'suspended' AND (LOWER(name) LIKE ${q} OR LOWER(email) LIKE ${q}) ORDER BY created_at DESC`
      : await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE seller_status = 'suspended' ORDER BY created_at DESC`;
    return result.rows;
  }
  if (filter === 'admins') {
    const result = q
      ? await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE role != 'user' AND (LOWER(name) LIKE ${q} OR LOWER(email) LIKE ${q}) ORDER BY created_at DESC`
      : await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE role != 'user' ORDER BY created_at DESC`;
    return result.rows;
  }
  if (filter === 'disabled') {
    const result = q
      ? await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE account_disabled = true AND (LOWER(name) LIKE ${q} OR LOWER(email) LIKE ${q}) ORDER BY created_at DESC`
      : await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE account_disabled = true ORDER BY created_at DESC`;
    return result.rows;
  }
  // 'all' or unspecified
  const result = q
    ? await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                FROM users WHERE LOWER(name) LIKE ${q} OR LOWER(email) LIKE ${q} ORDER BY created_at DESC LIMIT 200`
    : await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                FROM users ORDER BY created_at DESC LIMIT 200`;
  return result.rows;
}

export async function getUserDetailForAdmin(userId: number) {
  const userResult = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
  const user = userResult.rows[0];
  if (!user) return null;

  // Count dishes, orders as buyer, orders as seller
  const dishCount = await sql`SELECT COUNT(*)::int as c FROM dishes WHERE seller_id = ${userId}`;
  const orderAsBuyer = await sql`SELECT COUNT(*)::int as c FROM orders WHERE buyer_id = ${userId}`;
  const orderAsSeller = await sql`SELECT COUNT(*)::int as c FROM orders o WHERE o.seller_id = ${userId}`;

  return {
    user,
    stats: {
      dishes: dishCount.rows[0].c,
      ordersAsBuyer: orderAsBuyer.rows[0].c,
      ordersAsSeller: orderAsSeller.rows[0].c,
    },
  };
}

export async function getAllDishesForAdmin(search?: string) {
  const q = search ? `%${search.toLowerCase()}%` : null;
  const result = q
    ? await sql`
        SELECT d.id, d.name, d.emoji, d.photo_url, d.price, d.likes, d.created_at,
               u.id as seller_id, u.name as seller_name, u.seller_status
        FROM dishes d JOIN users u ON d.seller_id = u.id
        WHERE LOWER(d.name) LIKE ${q} OR LOWER(u.name) LIKE ${q}
        ORDER BY d.created_at DESC LIMIT 200
      `
    : await sql`
        SELECT d.id, d.name, d.emoji, d.photo_url, d.price, d.likes, d.created_at,
               u.id as seller_id, u.name as seller_name, u.seller_status
        FROM dishes d JOIN users u ON d.seller_id = u.id
        ORDER BY d.created_at DESC LIMIT 200
      `;
  return result.rows;
}

export async function adminDeleteDish(dishId: number) {
  await sql`DELETE FROM dishes WHERE id = ${dishId}`;
  return { success: true };
}

export async function getAdminStats() {
  const pending = await sql`SELECT COUNT(*)::int as c FROM users WHERE seller_status = 'pending' AND account_disabled = false`;
  const sellers = await sql`SELECT COUNT(*)::int as c FROM users WHERE seller_status = 'approved'`;
  const suspended = await sql`SELECT COUNT(*)::int as c FROM users WHERE seller_status = 'suspended'`;
  const admins = await sql`SELECT COUNT(*)::int as c FROM users WHERE role != 'user'`;
  const totalUsers = await sql`SELECT COUNT(*)::int as c FROM users`;
  const totalDishes = await sql`SELECT COUNT(*)::int as c FROM dishes`;
  // Excludes cancelled so it matches the Financials "Orders" card
  const totalOrders = await sql`SELECT COUNT(*)::int as c FROM orders WHERE status != 'cancelled'`;
  const orphanDishes = await sql`SELECT COUNT(*)::int as c FROM dishes WHERE photo_url IS NULL`;

  const openBugs = await sql`SELECT COUNT(*)::int as c FROM bug_reports WHERE status = 'open'`;

  return {
    pending: pending.rows[0].c,
    sellers: sellers.rows[0].c,
    suspended: suspended.rows[0].c,
    admins: admins.rows[0].c,
    totalUsers: totalUsers.rows[0].c,
    totalDishes: totalDishes.rows[0].c,
    totalOrders: totalOrders.rows[0].c,
    orphanDishes: orphanDishes.rows[0].c,
    openBugs: openBugs.rows[0].c,
  };
}

export async function getAdminUserOrders(userId: number) {
  const result = await sql`
    SELECT o.id, o.buyer_id, o.dish_id, o.quantity, o.total_price, o.status, o.pickup_code,
           o.created_at, COALESCE(d.name, 'Deleted dish') as dish_name, COALESCE(d.emoji, '🍽️') as dish_emoji,
           COALESCE(b.name, 'Deleted user') as buyer_name, COALESCE(s.name, 'Deleted cook') as seller_name, o.seller_id
    FROM orders o
    LEFT JOIN dishes d ON o.dish_id = d.id
    LEFT JOIN users b ON o.buyer_id = b.id
    LEFT JOIN users s ON s.id = o.seller_id
    WHERE o.buyer_id = ${userId} OR o.seller_id = ${userId}
    ORDER BY o.created_at DESC LIMIT 100
  `;
  return result.rows;
}
// Financial + volume stats for the admin dashboard.
export async function getAdminFinancials() {
  // Platform revenue + volume from non-cancelled orders
  const totals = await sql`
    SELECT
      COALESCE(SUM(o.total_price), 0) as gross_sales,
      COALESCE(SUM(o.platform_fee), 0) as platform_revenue,
      COALESCE(SUM(o.cook_earnings), 0) as cook_payouts,
      COUNT(*)::int as order_count
    FROM orders o
    WHERE o.status != 'cancelled'
  `;

  // Top cooks by revenue they've generated for the platform
  const topCooks = await sql`
    SELECT u.id, u.name, u.kitchen_name,
           COUNT(o.id)::int as order_count,
           COALESCE(SUM(o.total_price), 0) as gross_sales,
           COALESCE(SUM(o.platform_fee), 0) as platform_revenue
    FROM orders o
    JOIN users u ON u.id = o.seller_id
    WHERE o.status != 'cancelled'
    GROUP BY u.id, u.name, u.kitchen_name
    ORDER BY gross_sales DESC
    LIMIT 10
  `;

  // Daily trend for the last 30 days
  const trend = await sql`
    SELECT DATE(o.created_at) as day,
           COUNT(*)::int as orders,
           COALESCE(SUM(o.total_price), 0) as sales,
           COALESCE(SUM(o.platform_fee), 0) as revenue
    FROM orders o
    WHERE o.status != 'cancelled'
      AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(o.created_at)
    ORDER BY day ASC
  `;

  return {
    totals: totals.rows[0],
    topCooks: topCooks.rows,
    trend: trend.rows,
  };
}

// ============= ADMIN FINANCIAL DRILL-DOWN =============
// Backing the detail pages behind each Financials card: a searchable,
// paginated list of every order, a searchable/paginated list of cooks with
// their payout totals, and a per-cook detail (summary + upcoming/past
// orders). All paginated — this scans the whole orders table otherwise.

export interface AdminOrdersListOptions {
  search?: string | null;
  status?: string | null; // OrderStatus, or 'all'/omitted for no filter
  limit?: number;
  offset?: number;
}

export async function getAllOrdersForAdmin(opts: AdminOrdersListOptions = {}) {
  const limit = opts.limit ?? 30;
  const offset = opts.offset ?? 0;
  const q = opts.search?.trim() ? `%${opts.search.trim().toLowerCase()}%` : null;
  const status = opts.status && opts.status !== 'all' ? opts.status : null;

  const params: unknown[] = [];
  let where = 'WHERE 1=1';
  if (q) {
    params.push(q);
    const p = `$${params.length}`;
    where += ` AND (o.id::text ILIKE ${p} OR LOWER(b.name) LIKE ${p} OR LOWER(b.email) LIKE ${p}
                OR LOWER(s.name) LIKE ${p} OR LOWER(s.kitchen_name) LIKE ${p} OR LOWER(d.name) LIKE ${p})`;
  }
  if (status) {
    params.push(status);
    where += ` AND o.status = $${params.length}`;
  }
  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  // LEFT JOINs + COALESCE labels: orders must stay visible even when their
  // dish or a participating user has since been deleted — the totals count
  // them, so the drill-down must show them too.
  const result = await sql.query(
    `SELECT o.id, o.quantity, o.total_price, o.platform_fee, o.cook_earnings, o.status,
            o.created_at, o.pickup_at, o.side_choice,
            COALESCE(d.name, 'Deleted dish') as dish_name, COALESCE(d.emoji, '🍽️') as dish_emoji,
            b.id as buyer_id, COALESCE(b.name, 'Deleted user') as buyer_name,
            o.seller_id, COALESCE(s.name, 'Deleted cook') as seller_name, s.kitchen_name as seller_kitchen_name
     FROM orders o
     LEFT JOIN dishes d ON o.dish_id = d.id
     LEFT JOIN users b ON o.buyer_id = b.id
     LEFT JOIN users s ON s.id = o.seller_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );
  return result.rows;
}

export interface AdminCookPayoutsListOptions {
  search?: string | null;
  limit?: number;
  offset?: number;
}

// Drill-down behind the Platform revenue and Gross sales cards.
// Revenue = the 15% commission (platform_fee); service fee and tax are shown
// separately in the gross breakdown since they're recorded per order only for
// orders placed after those columns shipped.
export async function getAdminFinanceBreakdown() {
  const revenue = await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS orders_today,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE))::int AS orders_month,
      COUNT(*)::int AS orders_all,
      COALESCE(SUM(platform_fee) FILTER (WHERE created_at >= CURRENT_DATE), 0) AS rev_today,
      COALESCE(SUM(platform_fee) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS rev_month,
      COALESCE(SUM(platform_fee) FILTER (WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)), 0) AS rev_year,
      COALESCE(SUM(platform_fee), 0) AS rev_all,
      COALESCE(SUM(service_fee), 0) AS service_fees_all,
      COALESCE(SUM(tax_amount), 0) AS tax_all
    FROM orders WHERE status != 'cancelled'
  `;
  const gross = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status != 'cancelled')::int AS order_count,
      COALESCE(SUM(total_price) FILTER (WHERE status != 'cancelled'), 0) AS gross_sales,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS refund_count,
      COALESCE(SUM(total_price) FILTER (WHERE status = 'cancelled'), 0) AS refund_total,
      COALESCE(SUM(tax_amount) FILTER (WHERE status != 'cancelled'), 0) AS tax_collected,
      COALESCE(SUM(service_fee) FILTER (WHERE status != 'cancelled'), 0) AS service_fees
    FROM orders
  `;
  return { revenue: revenue.rows[0], gross: gross.rows[0] };
}

export async function getAllCooksForAdminPayouts(opts: AdminCookPayoutsListOptions = {}) {
  const limit = opts.limit ?? 30;
  const offset = opts.offset ?? 0;
  const q = opts.search?.trim() ? `%${opts.search.trim().toLowerCase()}%` : null;

  const params: unknown[] = [];
  let where = "WHERE u.seller_status = 'approved'";
  if (q) {
    params.push(q);
    const p = `$${params.length}`;
    where += ` AND (LOWER(u.name) LIKE ${p} OR LOWER(u.kitchen_name) LIKE ${p} OR LOWER(u.email) LIKE ${p})`;
  }
  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  // Attribution goes through orders.seller_id (snapshotted at checkout), so
  // a cook's numbers survive their dishes being deleted.
  const result = await sql.query(
    `SELECT u.id, u.name, u.kitchen_name, u.avatar, u.photo_url,
            u.stripe_charges_enabled, u.stripe_payouts_enabled,
            COALESCE(SUM(o.total_price) FILTER (WHERE o.status != 'cancelled'), 0) as total_sales,
            COALESCE(SUM(o.platform_fee) FILTER (WHERE o.status != 'cancelled'), 0) as platform_revenue,
            COALESCE(SUM(o.cook_earnings) FILTER (WHERE o.status != 'cancelled'), 0) as cook_earnings,
            COUNT(o.id) FILTER (WHERE o.status != 'cancelled')::int as order_count
     FROM users u
     LEFT JOIN orders o ON o.seller_id = u.id
     ${where}
     GROUP BY u.id, u.name, u.kitchen_name, u.avatar, u.photo_url, u.stripe_charges_enabled, u.stripe_payouts_enabled
     ORDER BY total_sales DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );

  // Orders that can't appear under any cook row above: seller unknown (dish
  // deleted before seller snapshots existed) or the cook's account has been
  // deleted. Surfaced so the list still reconciles with the Financials totals.
  const unattributed = await sql`
    SELECT COALESCE(SUM(o.cook_earnings), 0) as cook_earnings,
           COALESCE(SUM(o.total_price), 0) as total_sales,
           COUNT(*)::int as order_count
    FROM orders o
    WHERE o.status != 'cancelled'
      AND (o.seller_id IS NULL
           OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.seller_id))
  `;

  // Platform-wide payout summary for the top of the cook payouts screen:
  // how many cooks have sold, their combined gross, the share owed to them
  // (earnings + tips), and how that splits into already-withdrawn vs still
  // sitting in Plates balances.
  const summary = await sql`
    SELECT COUNT(DISTINCT o.seller_id)::int AS cook_count,
           COALESCE(SUM(o.total_price), 0) AS gross_sales,
           COALESCE(SUM(COALESCE(o.cook_earnings, 0) + COALESCE(o.tip_amount, 0)), 0) AS net_owed
    FROM orders o
    WHERE o.status != 'cancelled' AND o.seller_id IS NOT NULL
  `;
  const withdrawn = await sql`
    SELECT COALESCE(SUM(amount - COALESCE(fee, 0)), 0) AS paid_out,
           COALESCE(SUM(amount), 0) AS withdrawn_total
    FROM cook_withdrawals
    WHERE status IN ('processing', 'paid')
  `;
  const s = summary.rows[0];
  const w = withdrawn.rows[0];
  return {
    cooks: result.rows,
    unattributed: unattributed.rows[0],
    summary: {
      cook_count: s.cook_count,
      gross_sales: s.gross_sales,
      net_owed: s.net_owed,
      paid_out: w.paid_out,
      to_be_paid: Math.max(0, Math.round((Number(s.net_owed) - Number(w.withdrawn_total)) * 100) / 100),
    },
  };
}

export async function getCookPayoutDetail(
  cookId: number,
  opts: { pastLimit?: number; pastOffset?: number } = {},
) {
  const pastLimit = opts.pastLimit ?? 30;
  const pastOffset = opts.pastOffset ?? 0;

  const cookResult = await sql`
    SELECT id, name, kitchen_name, avatar, photo_url, email,
           stripe_charges_enabled, stripe_payouts_enabled
    FROM users WHERE id = ${cookId} LIMIT 1
  `;
  const cook = cookResult.rows[0];
  if (!cook) return null;

  const summaryResult = await sql`
    SELECT
      COALESCE(SUM(o.total_price), 0) as total_sales,
      COALESCE(SUM(o.platform_fee), 0) as platform_revenue,
      COALESCE(SUM(o.cook_earnings), 0) as cook_earnings,
      COUNT(*)::int as order_count
    FROM orders o
    WHERE o.seller_id = ${cookId} AND o.status != 'cancelled'
  `;

  // Active orders: money already earned per our stored split (Stripe moves
  // funds to the cook's connected account at charge time), pickup pending.
  const upcomingResult = await sql`
    SELECT o.id, o.quantity, o.total_price, o.platform_fee, o.cook_earnings, o.status,
           o.created_at, o.pickup_at, o.side_choice,
           COALESCE(d.name, 'Deleted dish') as dish_name, COALESCE(d.emoji, '🍽️') as dish_emoji,
           COALESCE(b.name, 'Deleted user') as buyer_name
    FROM orders o
    LEFT JOIN dishes d ON o.dish_id = d.id
    LEFT JOIN users b ON o.buyer_id = b.id
    WHERE o.seller_id = ${cookId} AND o.status NOT IN ('picked_up', 'cancelled')
    ORDER BY o.pickup_at ASC NULLS LAST, o.created_at ASC
    LIMIT 100
  `;

  const pastResult = await sql`
    SELECT o.id, o.quantity, o.total_price, o.platform_fee, o.cook_earnings, o.status,
           o.created_at, o.pickup_at, o.updated_at, o.side_choice,
           COALESCE(d.name, 'Deleted dish') as dish_name, COALESCE(d.emoji, '🍽️') as dish_emoji,
           COALESCE(b.name, 'Deleted user') as buyer_name
    FROM orders o
    LEFT JOIN dishes d ON o.dish_id = d.id
    LEFT JOIN users b ON o.buyer_id = b.id
    WHERE o.seller_id = ${cookId} AND o.status = 'picked_up'
    ORDER BY o.updated_at DESC
    LIMIT ${pastLimit} OFFSET ${pastOffset}
  `;

  const [balance, withdrawals] = await Promise.all([
    getCookBalance(cookId),
    getCookWithdrawals(cookId, 10),
  ]);

  return {
    cook,
    summary: summaryResult.rows[0],
    balance,
    withdrawals,
    upcoming: upcomingResult.rows,
    past: pastResult.rows,
  };
}

// ============= REVIEWS =============

export async function createReview(orderId: string, dishId: number, buyerId: number, rating: number, comment: string | null) {
  if (rating < 1 || rating > 5) throw new Error('Rating must be 1-5');
  const cleanComment = comment ? String(comment).trim().slice(0, 500) : null;
  const result = await sql`
    INSERT INTO dish_reviews (order_id, dish_id, buyer_id, rating, comment)
    VALUES (${orderId}, ${dishId}, ${buyerId}, ${rating}, ${cleanComment})
    RETURNING *
  `;
  return result.rows[0];
}

// Get review for a specific order (buyers can only rate once per order — see UNIQUE constraint)
export async function getReviewForOrder(orderId: string) {
  const result = await sql`SELECT * FROM dish_reviews WHERE order_id = ${orderId} LIMIT 1`;
  return result.rows[0] || null;
}

// List all reviews for a dish, with buyer names
export async function getReviewsForDish(dishId: number) {
  const result = await sql`
    SELECT r.*, u.name as buyer_name, u.avatar as buyer_avatar, u.photo_url as buyer_photo_url
    FROM dish_reviews r
    JOIN users u ON r.buyer_id = u.id
    WHERE r.dish_id = ${dishId}
    ORDER BY r.created_at DESC
  `;
  return result.rows;
}

// Get orders that are picked_up and don't have a review yet (for the "rate your recent order?" prompt)
export async function getUnreviewedOrdersForBuyer(buyerId: number) {
  const result = await sql`
    SELECT o.id as order_id, o.dish_id, o.created_at, o.updated_at,
           d.name as dish_name, d.emoji as dish_emoji, d.photo_url as dish_photo_url,
           u.name as seller_name, u.kitchen_name as seller_kitchen_name
    FROM orders o
    JOIN dishes d ON o.dish_id = d.id
    JOIN users u ON d.seller_id = u.id
    LEFT JOIN dish_reviews r ON r.order_id = o.id
    WHERE o.buyer_id = ${buyerId}
      AND o.status = 'picked_up'
      AND r.id IS NULL
    ORDER BY o.updated_at DESC
    LIMIT 5
  `;
  return result.rows;
}

// ============= COMMUNITY FEED (24hr posts) =============

// Opportunistic cleanup — deletes expired posts (their comments + reactions cascade).
// Called by getFeed on read, so no cron needed. Cheap due to expires_at index.
export async function pruneExpiredPosts() {
  await sql`DELETE FROM posts WHERE expires_at < CURRENT_TIMESTAMP`;
}

export async function createPost(userId: number, body: string, photoUrl: string | null) {
  const trimmed = String(body || '').trim();
  if (!trimmed) throw new Error('Post text is required');
  if (trimmed.length > 500) throw new Error('Post text is too long (max 500 chars)');
  // Snapshot poster's profile location at time of post — feed uses this for distance filtering
  const result = await sql`
    INSERT INTO posts (user_id, body, photo_url, latitude, longitude)
    SELECT ${userId}, ${trimmed}, ${photoUrl}, u.latitude, u.longitude
    FROM users u WHERE u.id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

// Feed with optional proximity filter.
// If viewerLat/viewerLng/radiusMi are all provided, only posts within radius are returned.
// If any is null, all posts are returned (global fallback).
// The `distance_mi` column is computed via Haversine formula in SQL.
export async function getFeed(
  viewerId: number | null,
  viewerLat?: number | null,
  viewerLng?: number | null,
  radiusMi?: number | null,
) {
  // Cleanup on read — cheap because of the index on expires_at
  await pruneExpiredPosts();

  const vId = viewerId ?? 0;

  // If we have a viewer location AND a radius, apply the proximity filter.
  // Otherwise return everything globally.
  const useProximity = viewerLat != null && viewerLng != null && radiusMi != null && radiusMi > 0;

  // Haversine formula returns distance in miles; 3959 = earth radius in miles.
  // We compute it as a column when possible (viewer has location) so the frontend
  // can display "0.8 mi away" chips.
  if (useProximity) {
    const result = await sql`
      SELECT
        p.id, p.body, p.photo_url, p.created_at, p.expires_at, p.user_id,
        p.latitude as post_latitude, p.longitude as post_longitude,
        u.name as author_name, u.avatar as author_avatar, u.photo_url as author_photo_url,
        u.seller_status as author_seller_status,
        u.kitchen_name as author_kitchen_name,
        COALESCE(rc.heart_count, 0)::int as heart_count,
        COALESCE(rc.fire_count, 0)::int as fire_count,
        COALESCE(rc.hands_count, 0)::int as hands_count,
        COALESCE(cc.comment_count, 0)::int as comment_count,
        COALESCE(vr.viewer_reactions, '{}')::text[] as viewer_reactions,
        CASE
          WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL
          THEN 3959 * 2 * ASIN(SQRT(
                 POWER(SIN((RADIANS(${viewerLat}) - RADIANS(p.latitude)) / 2), 2) +
                 COS(RADIANS(p.latitude)) * COS(RADIANS(${viewerLat})) *
                 POWER(SIN((RADIANS(${viewerLng}) - RADIANS(p.longitude)) / 2), 2)
               ))
          ELSE NULL
        END as distance_mi
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT post_id,
          COUNT(*) FILTER (WHERE kind = 'heart') as heart_count,
          COUNT(*) FILTER (WHERE kind = 'fire') as fire_count,
          COUNT(*) FILTER (WHERE kind = 'hands') as hands_count
        FROM post_reactions GROUP BY post_id
      ) rc ON rc.post_id = p.id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as comment_count
        FROM post_comments GROUP BY post_id
      ) cc ON cc.post_id = p.id
      LEFT JOIN (
        SELECT post_id, ARRAY_AGG(kind) as viewer_reactions
        FROM post_reactions WHERE user_id = ${vId}
        GROUP BY post_id
      ) vr ON vr.post_id = p.id
      WHERE p.expires_at > CURRENT_TIMESTAMP
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND (3959 * 2 * ASIN(SQRT(
              POWER(SIN((RADIANS(${viewerLat}) - RADIANS(p.latitude)) / 2), 2) +
              COS(RADIANS(p.latitude)) * COS(RADIANS(${viewerLat})) *
              POWER(SIN((RADIANS(${viewerLng}) - RADIANS(p.longitude)) / 2), 2)
            ))) <= ${radiusMi}
      ORDER BY p.created_at DESC
      LIMIT 100
    `;
    return result.rows;
  }

  // Global fallback: no proximity filter. distance_mi is null.
  const result = await sql`
    SELECT
      p.id, p.body, p.photo_url, p.created_at, p.expires_at, p.user_id,
      p.latitude as post_latitude, p.longitude as post_longitude,
      u.name as author_name, u.avatar as author_avatar, u.photo_url as author_photo_url,
      u.seller_status as author_seller_status,
      u.kitchen_name as author_kitchen_name,
      COALESCE(rc.heart_count, 0)::int as heart_count,
      COALESCE(rc.fire_count, 0)::int as fire_count,
      COALESCE(rc.hands_count, 0)::int as hands_count,
      COALESCE(cc.comment_count, 0)::int as comment_count,
      COALESCE(vr.viewer_reactions, '{}')::text[] as viewer_reactions,
      NULL::double precision as distance_mi
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN (
      SELECT post_id,
        COUNT(*) FILTER (WHERE kind = 'heart') as heart_count,
        COUNT(*) FILTER (WHERE kind = 'fire') as fire_count,
        COUNT(*) FILTER (WHERE kind = 'hands') as hands_count
      FROM post_reactions GROUP BY post_id
    ) rc ON rc.post_id = p.id
    LEFT JOIN (
      SELECT post_id, COUNT(*)::int as comment_count
      FROM post_comments GROUP BY post_id
    ) cc ON cc.post_id = p.id
    LEFT JOIN (
      SELECT post_id, ARRAY_AGG(kind) as viewer_reactions
      FROM post_reactions WHERE user_id = ${vId}
      GROUP BY post_id
    ) vr ON vr.post_id = p.id
    WHERE p.expires_at > CURRENT_TIMESTAMP
    ORDER BY p.created_at DESC
    LIMIT 100
  `;
  return result.rows;
}

export async function getPost(postId: number) {
  const result = await sql`SELECT * FROM posts WHERE id = ${postId} LIMIT 1`;
  return result.rows[0] || null;
}

export async function deletePost(postId: number) {
  await sql`DELETE FROM posts WHERE id = ${postId}`;
  return { success: true };
}

export async function togglePostReaction(postId: number, userId: number, kind: 'heart' | 'fire' | 'hands') {
  // Toggle: if the user already reacted with this kind, remove it; else add it
  const existing = await sql`
    SELECT 1 FROM post_reactions WHERE post_id = ${postId} AND user_id = ${userId} AND kind = ${kind} LIMIT 1
  `;
  if (existing.rows[0]) {
    await sql`DELETE FROM post_reactions WHERE post_id = ${postId} AND user_id = ${userId} AND kind = ${kind}`;
    return { active: false };
  }
  await sql`INSERT INTO post_reactions (post_id, user_id, kind) VALUES (${postId}, ${userId}, ${kind}) ON CONFLICT DO NOTHING`;
  return { active: true };
}

export async function getCommentsForPost(postId: number) {
  const result = await sql`
    SELECT c.*, u.name as author_name, u.avatar as author_avatar, u.photo_url as author_photo_url
    FROM post_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ${postId}
    ORDER BY c.created_at ASC
  `;
  return result.rows;
}

export async function createComment(postId: number, userId: number, body: string) {
  const trimmed = String(body || '').trim();
  if (!trimmed) throw new Error('Comment cannot be empty');
  if (trimmed.length > 300) throw new Error('Comment too long (max 300 chars)');
  const result = await sql`
    INSERT INTO post_comments (post_id, user_id, body)
    VALUES (${postId}, ${userId}, ${trimmed})
    RETURNING *
  `;
  return result.rows[0];
}

export async function deleteComment(commentId: number) {
  await sql`DELETE FROM post_comments WHERE id = ${commentId}`;
  return { success: true };
}

export async function getCommentAuthor(commentId: number): Promise<number | null> {
  const result = await sql`SELECT user_id FROM post_comments WHERE id = ${commentId} LIMIT 1`;
  return result.rows[0]?.user_id ?? null;
}

// ============= PICKUP HOURS =============

export interface PickupHoursRow {
  id: number;
  user_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  daily_capacity: number | null;
}

export async function getPickupHours(userId: number) {
  const result = await sql`
    SELECT * FROM pickup_hours WHERE user_id = ${userId} ORDER BY day_of_week ASC
  `;
  return result.rows;
}

// Upsert a single day's hours. Passing null start_time deletes it (closed that day).
export async function setPickupDay(
  userId: number,
  dayOfWeek: number,
  startTime: string | null,
  endTime: string | null,
  dailyCapacity: number | null,
) {
  if (dayOfWeek < 0 || dayOfWeek > 6) throw new Error('Invalid day_of_week');
  // Closed that day: remove the row
  if (!startTime || !endTime) {
    await sql`DELETE FROM pickup_hours WHERE user_id = ${userId} AND day_of_week = ${dayOfWeek}`;
    return { deleted: true };
  }
  // Basic format check (HH:MM). We trust the client to send strings in this shape.
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    throw new Error('Times must be HH:MM (24h)');
  }
  if (startTime >= endTime) throw new Error('End time must be after start time');
  const cap = dailyCapacity != null && dailyCapacity > 0 ? Math.floor(dailyCapacity) : null;
  const result = await sql`
    INSERT INTO pickup_hours (user_id, day_of_week, start_time, end_time, daily_capacity)
    VALUES (${userId}, ${dayOfWeek}, ${startTime}, ${endTime}, ${cap})
    ON CONFLICT (user_id, day_of_week) DO UPDATE SET
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      daily_capacity = EXCLUDED.daily_capacity
    RETURNING *
  `;
  return result.rows[0];
}

// Public: get a specific cook's available slots for TODAY (or a given date).
// Returns slots + remaining capacity for that date.
export async function getAvailableSlotsForCook(sellerUserId: number, isoDateString: string) {
  // Parse to determine day-of-week
  const date = new Date(isoDateString + 'T00:00:00');
  const dow = date.getDay();

  const hoursResult = await sql`
    SELECT * FROM pickup_hours WHERE user_id = ${sellerUserId} AND day_of_week = ${dow} LIMIT 1
  `;
  const hours = hoursResult.rows[0];
  if (!hours) return { open: false, slots: [], dailyCapacity: null, ordersToday: 0, remaining: 0 };

  // Count today's orders for this seller (any of their dishes)
  const orderCountResult = await sql`
    SELECT COUNT(*)::int as c FROM orders o
    WHERE o.seller_id = ${sellerUserId}
      AND o.pickup_date = ${isoDateString}
      AND o.status NOT IN ('cancelled')
  `;
  const ordersToday = orderCountResult.rows[0].c;
  const cap = hours.daily_capacity;
  const remaining = cap != null ? Math.max(0, cap - ordersToday) : Number.POSITIVE_INFINITY;

  // Generate 15-min slots within [start, end]
  const [sh, sm] = String(hours.start_time).split(':').map((n: string) => parseInt(n));
  const [eh, em] = String(hours.end_time).split(':').map((n: string) => parseInt(n));
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const slots: string[] = [];
  for (let m = startMinutes; m < endMinutes; m += 15) {
    const hh = Math.floor(m / 60).toString().padStart(2, '0');
    const mm = (m % 60).toString().padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }

  return {
    open: true,
    slots,
    dailyCapacity: cap,
    ordersToday,
    remaining: cap != null ? remaining : null,
    startTime: hours.start_time,
    endTime: hours.end_time,
  };
}

// ============= COOK PROFILES (public) =============

// Public cook profile: only for approved, non-disabled cooks. Returns null otherwise.
export async function getCookPublicProfile(userId: number) {
  const userResult = await sql`
    SELECT id, name, avatar, photo_url, bio,
           kitchen_name, pickup_description, kitchen_flags,
           COALESCE(kitchen_latitude, latitude) as latitude,
           COALESCE(kitchen_longitude, longitude) as longitude,
           prep_address,
           seller_status, account_disabled,
           created_at
    FROM users WHERE id = ${userId} LIMIT 1
  `;
  const user = userResult.rows[0];
  if (!user || user.seller_status !== 'approved' || user.account_disabled) {
    return null;
  }

  // Their currently-posted daily dishes, excluding hidden and catering items.
  const dishesResult = await sql`
    SELECT d.id, d.name, d.description, d.price, d.emoji, d.photo_url, d.likes,
           d.is_featured, d.is_catering, d.created_at,
           COALESCE(ROUND(d.rating_sum::numeric / NULLIF(d.rating_count, 0), 1), 0) as avg_rating,
           d.rating_count as review_count
    FROM dishes d
    WHERE d.seller_id = ${userId}
      AND (d.is_hidden_from_profile IS DISTINCT FROM true)
      AND (d.is_catering IS DISTINCT FROM true)
    ORDER BY d.is_featured DESC, d.created_at DESC
  `;

  // Their catering menu — shown in its own section, ordered ahead for a
  // buyer-scheduled pickup date.
  const cateringResult = await sql`
    SELECT d.id, d.name, d.description, d.price, d.emoji, d.photo_url, d.likes,
           d.is_featured, d.is_catering, d.created_at,
           COALESCE(ROUND(d.rating_sum::numeric / NULLIF(d.rating_count, 0), 1), 0) as avg_rating,
           d.rating_count as review_count
    FROM dishes d
    WHERE d.seller_id = ${userId}
      AND (d.is_hidden_from_profile IS DISTINCT FROM true)
      AND d.is_catering = true
    ORDER BY d.is_featured DESC, d.created_at DESC
  `;

  // Aggregate rating across all their dishes, from the cached per-dish totals.
  const aggResult = await sql`
    SELECT ROUND(SUM(rating_sum)::numeric / NULLIF(SUM(rating_count), 0), 1) as avg_rating,
           COALESCE(SUM(rating_count), 0)::int as review_count
    FROM dishes
    WHERE seller_id = ${userId}
  `;
  const agg = aggResult.rows[0] || { avg_rating: null, review_count: 0 };

  // Their active (non-expired) community posts
  await pruneExpiredPosts();
  const postsResult = await sql`
    SELECT p.id, p.body, p.photo_url, p.created_at, p.expires_at,
           COALESCE(rc.heart_count, 0)::int as heart_count,
           COALESCE(rc.fire_count, 0)::int as fire_count,
           COALESCE(rc.hands_count, 0)::int as hands_count,
           COALESCE(cc.comment_count, 0)::int as comment_count
    FROM posts p
    LEFT JOIN (
      SELECT post_id,
        COUNT(*) FILTER (WHERE kind = 'heart') as heart_count,
        COUNT(*) FILTER (WHERE kind = 'fire') as fire_count,
        COUNT(*) FILTER (WHERE kind = 'hands') as hands_count
      FROM post_reactions GROUP BY post_id
    ) rc ON rc.post_id = p.id
    LEFT JOIN (
      SELECT post_id, COUNT(*)::int as comment_count
      FROM post_comments GROUP BY post_id
    ) cc ON cc.post_id = p.id
    WHERE p.user_id = ${userId}
      AND p.expires_at > CURRENT_TIMESTAMP
    ORDER BY p.created_at DESC
    LIMIT 20
  `;

  return {
    cook: user,
    dishes: dishesResult.rows,
    cateringDishes: cateringResult.rows,
    aggregateRating: {
      avg: agg.avg_rating != null ? Number(agg.avg_rating) : null,
      count: agg.review_count,
    },
    posts: postsResult.rows,
  };
}

export async function updateDishFeatured(dishId: number, featured: boolean) {
  const result = await sql`
    UPDATE dishes SET is_featured = ${featured} WHERE id = ${dishId} RETURNING *
  `;
  return result.rows[0];
}

export async function updateDishHidden(dishId: number, hidden: boolean) {
  const result = await sql`
    UPDATE dishes SET is_hidden_from_profile = ${hidden} WHERE id = ${dishId} RETURNING *
  `;
  return result.rows[0];
}

export async function updateUserBio(userId: number, bio: string) {
  const clean = String(bio || '').trim().slice(0, 500);
  const result = await sql`
    UPDATE users SET bio = ${clean} WHERE id = ${userId} RETURNING *
  `;
  return result.rows[0];
}

// ============= TERMS ACCEPTANCE =============

export async function acceptTerms(userId: number, version: string) {
  const result = await sql`
    UPDATE users
    SET terms_accepted_at = CURRENT_TIMESTAMP, terms_version = ${version}
    WHERE id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

// ============= STRIPE CONNECT =============

export async function setStripeAccountId(userId: number, stripeAccountId: string) {
  const result = await sql`
    UPDATE users SET stripe_account_id = ${stripeAccountId} WHERE id = ${userId} RETURNING *
  `;
  return result.rows[0];
}

export async function updateStripeAccountStatus(
  stripeAccountId: string,
  chargesEnabled: boolean,
  payoutsEnabled: boolean,
) {
  const result = await sql`
    UPDATE users
    SET stripe_charges_enabled = ${chargesEnabled}, stripe_payouts_enabled = ${payoutsEnabled}
    WHERE stripe_account_id = ${stripeAccountId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function getUserByStripeAccountId(stripeAccountId: string) {
  const result = await sql`SELECT * FROM users WHERE stripe_account_id = ${stripeAccountId} LIMIT 1`;
  return result.rows[0] || null;
}

export async function getCartGroupedBySeller(buyerId: number) {
  const items = await getCart(buyerId);
  const bySeller = new Map<number, typeof items>();
  for (const item of items) {
    const sellerId = item.seller_id;
    if (!bySeller.has(sellerId)) bySeller.set(sellerId, []);
    bySeller.get(sellerId)!.push(item);
  }
  return bySeller;
}

export async function setOrderPaymentIntent(orderId: string, paymentIntentId: string) {
  const result = await sql`
    UPDATE orders SET stripe_payment_intent_id = ${paymentIntentId} WHERE id = ${orderId} RETURNING *
  `;
  return result.rows[0];
}

export async function getOrderByPaymentIntent(paymentIntentId: string) {
  const result = await sql`
    SELECT * FROM orders WHERE stripe_payment_intent_id = ${paymentIntentId} LIMIT 1
  `;
  return result.rows[0] || null;
}
