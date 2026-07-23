import { sql } from '@vercel/postgres';
import { PLATES_FEE_PERCENT } from './fees';

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
  const result = await sql`
    UPDATE users SET latitude = ${latitude}, longitude = ${longitude} WHERE id = ${id} RETURNING *
  `;
  return result.rows[0];
}

export async function updateUserAddress(id: number, address: string, latitude: number, longitude: number) {
  const result = await sql`
    UPDATE users SET prep_address = ${address}, latitude = ${latitude}, longitude = ${longitude}
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

export async function createDish(sellerId: number, name: string, description: string, price: number, emoji: string, photoUrl: string | null) {
  const result = await sql`
    INSERT INTO dishes (seller_id, name, description, price, emoji, photo_url)
    VALUES (${sellerId}, ${name}, ${description}, ${price}, ${emoji}, ${photoUrl})
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
  // Pagination. limit null = no limit (legacy behavior); offset defaults to 0.
  limit?: number | null;
  offset?: number | null;
}

export async function getDishes(opts: GetDishesOptions = {}) {
  const lat = opts.lat ?? null;
  const lng = opts.lng ?? null;
  const radiusMiles = opts.radiusMiles ?? null;
  const limit = opts.limit ?? null;
  const offset = opts.offset ?? 0;

  const hasLoc =
    Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusMiles);

  // Great-circle distance in miles. GREATEST/LEAST clamp the acos argument to
  // [-1, 1] to avoid NaN from floating-point rounding on near-identical points.
  const distanceExpr = `
    3959 * acos(GREATEST(-1, LEAST(1,
      cos(radians($1)) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians($2))
      + sin(radians($1)) * sin(radians(u.latitude))
    )))`;

  const params: unknown[] = [];
  let distanceSelect = 'NULL::double precision';
  let locFilter = '';
  if (hasLoc) {
    params.push(lat, lng, radiusMiles); // $1, $2, $3
    distanceSelect = distanceExpr;
    locFilter = `
      AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
      AND (${distanceExpr}) <= $3`;
  }

  let text = `
    SELECT d.*, u.name as seller_name, u.avatar as seller_avatar, u.photo_url as seller_photo_url,
           u.latitude as seller_latitude, u.longitude as seller_longitude,
           u.kitchen_flags as seller_kitchen_flags,
           u.kitchen_environment as seller_kitchen_environment,
           u.pickup_description as seller_pickup_description,
           u.cooking_hours as seller_cooking_hours,
           u.pickup_min_minutes as seller_pickup_min_minutes,
           u.pickup_max_minutes as seller_pickup_max_minutes,
           COALESCE(r.avg_rating, 0) as avg_rating,
           COALESCE(r.review_count, 0)::int as review_count,
           (${distanceSelect}) as distance_miles
    FROM dishes d
    JOIN users u ON d.seller_id = u.id
    LEFT JOIN (
      SELECT dish_id, ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*)::int as review_count
      FROM dish_reviews GROUP BY dish_id
    ) r ON r.dish_id = d.id
    WHERE u.seller_status = 'approved'
      AND u.account_disabled = false
      ${locFilter}
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

export async function getDish(id: number) {
  const result = await sql`
    SELECT d.*, u.name as seller_name, u.avatar as seller_avatar, u.id as seller_id,
           COALESCE(r.avg_rating, 0) as avg_rating,
           COALESCE(r.review_count, 0)::int as review_count
    FROM dishes d
    JOIN users u ON d.seller_id = u.id
    LEFT JOIN (
      SELECT dish_id, ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*)::int as review_count
      FROM dish_reviews GROUP BY dish_id
    ) r ON r.dish_id = d.id
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
           o.created_at, o.updated_at, o.pickup_at,
           d.name as dish_name, d.emoji as dish_emoji, d.photo_url as dish_photo_url, d.price as dish_price,
           u.id as seller_id, u.name as seller_name, u.avatar as seller_avatar,
           u.photo_url as seller_photo_url,
           u.latitude as seller_latitude, u.longitude as seller_longitude,
           u.prep_address as seller_address,
           u.kitchen_name as seller_kitchen_name,
           u.cooking_hours as seller_cooking_hours,
           u.pickup_description as seller_pickup_description
    FROM orders o
    JOIN dishes d ON o.dish_id = d.id
    JOIN users u ON d.seller_id = u.id
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
    SELECT o.id, o.status, o.stripe_payment_intent_id, d.seller_id
    FROM orders o
    JOIN dishes d ON o.dish_id = d.id
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
    JOIN dishes d ON o.dish_id = d.id
    WHERE d.seller_id = ${userId}
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

  // 4. Snapshot buyer name/email onto every order they placed, so accounting
  //    still reads. buyer_id will be nulled by the FK ON DELETE SET NULL
  //    when the user row is deleted below.
  await sql`
    UPDATE orders
       SET buyer_name_snapshot  = ${user.name},
           buyer_email_snapshot = ${user.email},
           deleted_at           = CURRENT_TIMESTAMP
     WHERE buyer_id = ${userId}
  `;

  // 5. Snapshot dish name/price onto every order for their dishes, so the
  //    money row survives after dishes are deleted below.
  await sql`
    UPDATE orders
       SET dish_name_snapshot  = d.name,
           dish_price_snapshot = d.price,
           deleted_at          = COALESCE(orders.deleted_at, CURRENT_TIMESTAMP)
      FROM dishes d
     WHERE orders.dish_id = d.id
       AND d.seller_id = ${userId}
  `;

  // 6. Collect Blob URLs we'll need to delete from storage AFTER db work.
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

  // 7. Delete dependent rows that we don't need to preserve.
  //    Order matters: children of dishes/posts before dishes/posts themselves.
  //    Skip 'orders' — those are preserved via SET NULL + snapshots.
  //    Skip 'messages' — will keep those tied to preserved orders (sender_id
  //    stays as it is; if you'd rather null it, we can add a snapshot later).
  await sql`DELETE FROM dish_reviews  WHERE buyer_id = ${userId} OR dish_id IN (SELECT id FROM dishes WHERE seller_id = ${userId})`;
  await sql`DELETE FROM dish_likes    WHERE user_id  = ${userId} OR dish_id IN (SELECT id FROM dishes WHERE seller_id = ${userId})`;
  await sql`DELETE FROM cart_items    WHERE buyer_id = ${userId} OR dish_id IN (SELECT id FROM dishes WHERE seller_id = ${userId})`;
  await sql`DELETE FROM post_comments WHERE user_id  = ${userId} OR post_id IN (SELECT id FROM posts WHERE user_id  = ${userId})`;
  await sql`DELETE FROM post_reactions WHERE user_id = ${userId} OR post_id IN (SELECT id FROM posts WHERE user_id  = ${userId})`;
  await sql`DELETE FROM messages      WHERE sender_id = ${userId}`;
  await sql`DELETE FROM pickup_hours  WHERE user_id = ${userId}`;
  await sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`;

  // 8. Delete their dishes and posts. Orders referencing them will have
  //    dish_id nulled by the FK; snapshots from step 5 preserve the info.
  await sql`DELETE FROM dishes WHERE seller_id = ${userId}`;
  await sql`DELETE FROM posts  WHERE user_id  = ${userId}`;

  // 9. Count what survived on the orders side for the response.
  const preservedCount = await sql`
    SELECT COUNT(*)::int AS c FROM orders
     WHERE buyer_name_snapshot  IS NOT NULL AND buyer_email_snapshot = ${user.email}
        OR (dish_name_snapshot  IS NOT NULL AND dish_id IS NULL)
  `;

  // 10. Finally, delete the user row itself. FK SET NULL fires on orders.
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
           o.created_at, o.updated_at, o.pickup_at,
           d.name as dish_name, d.emoji as dish_emoji, d.photo_url as dish_photo_url,
           u.name as buyer_name, u.avatar as buyer_avatar, u.photo_url as buyer_photo_url
    FROM orders o
    JOIN dishes d ON o.dish_id = d.id
    JOIN users u ON o.buyer_id = u.id
    WHERE d.seller_id = ${sellerId}
    ORDER BY o.created_at DESC
  `;
  return result.rows;
}

export async function getCart(buyerId: number) {
  const result = await sql`
    SELECT c.id as cart_item_id, c.quantity, d.*,
           u.id as seller_id,
           u.name as seller_name, u.avatar as seller_avatar, u.photo_url as seller_photo_url,
           u.latitude as seller_latitude, u.longitude as seller_longitude,
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
    JOIN dishes d ON o.dish_id = d.id
    WHERE d.seller_id = ${sellerId}
      AND o.status != 'cancelled'
  `;
  const thisWeek = await sql`
    SELECT
      COALESCE(SUM(o.cook_earnings), 0) as total_earnings,
      COALESCE(SUM(o.total_price), 0) as total_sales,
      COUNT(*)::int as order_count
    FROM orders o
    JOIN dishes d ON o.dish_id = d.id
    WHERE d.seller_id = ${sellerId}
      AND o.status != 'cancelled'
      AND o.created_at >= DATE_TRUNC('week', CURRENT_DATE)
  `;
  const thisMonth = await sql`
    SELECT
      COALESCE(SUM(o.cook_earnings), 0) as total_earnings,
      COALESCE(SUM(o.total_price), 0) as total_sales,
      COUNT(*)::int as order_count
    FROM orders o
    JOIN dishes d ON o.dish_id = d.id
    WHERE d.seller_id = ${sellerId}
      AND o.status != 'cancelled'
      AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
  `;
  const recent = await sql`
    SELECT o.id, o.total_price, o.cook_earnings, o.platform_fee, o.status, o.created_at,
           d.name as dish_name, d.emoji as dish_emoji
    FROM orders o
    JOIN dishes d ON o.dish_id = d.id
    WHERE d.seller_id = ${sellerId}
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
export async function addToCart(buyerId: number, dishId: number, quantity: number) {
  const result = await sql`
    INSERT INTO cart_items (buyer_id, dish_id, quantity)
    VALUES (${buyerId}, ${dishId}, ${quantity})
    ON CONFLICT (buyer_id, dish_id)
    DO UPDATE SET quantity = cart_items.quantity + ${quantity}
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
  for (const item of items) {
    const linePrice = Number(item.price) * item.quantity;
    total += linePrice;
    const pickupCode = String(Math.floor(1000 + Math.random() * 9000));
    const order = await sql`
      INSERT INTO orders (buyer_id, dish_id, quantity, total_price, status, pickup_code, pickup_at, stripe_payment_intent_id)
      VALUES (${buyerId}, ${item.id}, ${item.quantity}, ${linePrice}, 'placed', ${pickupCode}, ${pickupAt}, ${primaryIntentId})
      RETURNING *
    `;
    orders.push(order.rows[0]);
  }
  await clearCart(buyerId);
  return { orders, total: total + tipAmount + serviceFee, subtotal: total, tip: tipAmount, fee: serviceFee };
}

// ============= MESSAGES =============

// Verify a user is a party to an order (buyer or seller). Returns the order row or null.
export async function getOrderIfParticipant(orderId: string, userId: number) {
  const result = await sql`
    SELECT o.*, d.seller_id
    FROM orders o
    JOIN dishes d ON o.dish_id = d.id
    WHERE o.id = ${orderId} AND (o.buyer_id = ${userId} OR d.seller_id = ${userId})
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
    JOIN dishes d ON o.dish_id = d.id
    LEFT JOIN messages m ON m.order_id = o.id AND m.sender_id != ${userId} AND m.read_at IS NULL
    WHERE (o.buyer_id = ${userId} OR d.seller_id = ${userId})
      AND o.status NOT IN ('picked_up', 'cancelled')
    GROUP BY o.id
    HAVING COUNT(m.id) > 0
  `;
  return result.rows;
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

export async function setUserRole(userId: number, role: 'user' | 'admin') {
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
                  FROM users WHERE role = 'admin' AND (LOWER(name) LIKE ${q} OR LOWER(email) LIKE ${q}) ORDER BY created_at DESC`
      : await sql`SELECT id, name, email, avatar, photo_url, role, seller_status, account_disabled, kitchen_name, created_at
                  FROM users WHERE role = 'admin' ORDER BY created_at DESC`;
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
  const orderAsSeller = await sql`SELECT COUNT(*)::int as c FROM orders o JOIN dishes d ON o.dish_id = d.id WHERE d.seller_id = ${userId}`;

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
  const admins = await sql`SELECT COUNT(*)::int as c FROM users WHERE role = 'admin'`;
  const totalUsers = await sql`SELECT COUNT(*)::int as c FROM users`;
  const totalDishes = await sql`SELECT COUNT(*)::int as c FROM dishes`;
  const totalOrders = await sql`SELECT COUNT(*)::int as c FROM orders`;
  const orphanDishes = await sql`SELECT COUNT(*)::int as c FROM dishes WHERE photo_url IS NULL`;

  return {
    pending: pending.rows[0].c,
    sellers: sellers.rows[0].c,
    suspended: suspended.rows[0].c,
    admins: admins.rows[0].c,
    totalUsers: totalUsers.rows[0].c,
    totalDishes: totalDishes.rows[0].c,
    totalOrders: totalOrders.rows[0].c,
    orphanDishes: orphanDishes.rows[0].c,
  };
}

export async function getAdminUserOrders(userId: number) {
  const result = await sql`
    SELECT o.id, o.buyer_id, o.dish_id, o.quantity, o.total_price, o.status, o.pickup_code,
           o.created_at, d.name as dish_name, d.emoji as dish_emoji,
           b.name as buyer_name, s.name as seller_name, s.id as seller_id
    FROM orders o
    JOIN dishes d ON o.dish_id = d.id
    JOIN users b ON o.buyer_id = b.id
    JOIN users s ON d.seller_id = s.id
    WHERE o.buyer_id = ${userId} OR d.seller_id = ${userId}
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
    JOIN dishes d ON o.dish_id = d.id
    JOIN users u ON d.seller_id = u.id
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
    JOIN dishes d ON o.dish_id = d.id
    WHERE d.seller_id = ${sellerUserId}
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
           latitude, longitude, prep_address,
           seller_status, account_disabled,
           created_at
    FROM users WHERE id = ${userId} LIMIT 1
  `;
  const user = userResult.rows[0];
  if (!user || user.seller_status !== 'approved' || user.account_disabled) {
    return null;
  }

  // Their currently-posted dishes, excluding ones they've hidden from their profile.
  const dishesResult = await sql`
    SELECT d.id, d.name, d.description, d.price, d.emoji, d.photo_url, d.likes,
           d.is_featured, d.created_at,
           COALESCE(r.avg_rating, 0) as avg_rating,
           COALESCE(r.review_count, 0)::int as review_count
    FROM dishes d
    LEFT JOIN (
      SELECT dish_id, ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*)::int as review_count
      FROM dish_reviews GROUP BY dish_id
    ) r ON r.dish_id = d.id
    WHERE d.seller_id = ${userId}
      AND (d.is_hidden_from_profile IS DISTINCT FROM true)
    ORDER BY d.is_featured DESC, d.created_at DESC
  `;

  // Aggregate rating across all their dishes
  const aggResult = await sql`
    SELECT ROUND(AVG(r.rating)::numeric, 1) as avg_rating, COUNT(*)::int as review_count
    FROM dish_reviews r
    JOIN dishes d ON r.dish_id = d.id
    WHERE d.seller_id = ${userId}
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
