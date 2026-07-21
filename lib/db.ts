import { sql } from '@vercel/postgres';

export async function initializeDatabase() {
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
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cooking_hours TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pickup_description TEXT`;
    // Auth columns
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id)`;

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

    await sql`CREATE INDEX IF NOT EXISTS idx_dishes_seller_id ON dishes(seller_id)`;
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
  cookingHours?: string | null;
  pickupDescription?: string | null;
}) {
  const result = await sql`
    UPDATE users SET
      legal_name = COALESCE(${data.legalName ?? null}, legal_name),
      kitchen_name = COALESCE(${data.kitchenName ?? null}, kitchen_name),
      cottage_food_attested = COALESCE(${data.cottageFoodAttested ?? null}, cottage_food_attested),
      has_permit = COALESCE(${data.hasPermit ?? null}, has_permit),
      permit_number = COALESCE(${data.permitNumber ?? null}, permit_number),
      kitchen_flags = COALESCE(${data.kitchenFlags ?? null}, kitchen_flags),
      cooking_hours = COALESCE(${data.cookingHours ?? null}, cooking_hours),
      pickup_description = COALESCE(${data.pickupDescription ?? null}, pickup_description)
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

export async function getDishes() {
  const result = await sql`
    SELECT d.*, u.name as seller_name, u.avatar as seller_avatar, u.photo_url as seller_photo_url,
           u.latitude as seller_latitude, u.longitude as seller_longitude,
           u.kitchen_flags as seller_kitchen_flags,
           u.pickup_description as seller_pickup_description,
           u.cooking_hours as seller_cooking_hours
    FROM dishes d
    JOIN users u ON d.seller_id = u.id
    ORDER BY d.created_at DESC
  `;
  return result.rows;
}

export async function getDish(id: number) {
  const result = await sql`
    SELECT d.*, u.name as seller_name, u.avatar as seller_avatar, u.id as seller_id
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

export async function createOrder(buyerId: number, dishId: number, quantity: number, totalPrice: number) {
  const result = await sql`
    INSERT INTO orders (buyer_id, dish_id, quantity, total_price)
    VALUES (${buyerId}, ${dishId}, ${quantity}, ${totalPrice})
    RETURNING *
  `;
  return result.rows[0];
}

export async function getOrders(buyerId: number) {
  const result = await sql`
    SELECT o.id, o.buyer_id, o.dish_id, o.quantity, o.total_price, o.status, o.pickup_code,
           o.created_at, o.updated_at,
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

export async function getSellerOrders(sellerId: number) {
  const result = await sql`
    SELECT o.id, o.buyer_id, o.dish_id, o.quantity, o.total_price, o.status, o.pickup_code,
           o.created_at, o.updated_at,
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
           u.name as seller_name, u.avatar as seller_avatar, u.photo_url as seller_photo_url,
           u.latitude as seller_latitude, u.longitude as seller_longitude
    FROM cart_items c
    JOIN dishes d ON c.dish_id = d.id
    JOIN users u ON d.seller_id = u.id
    WHERE c.buyer_id = ${buyerId}
    ORDER BY c.created_at ASC
  `;
  return result.rows;
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

export async function checkoutCart(buyerId: number, tipAmount: number, serviceFee: number) {
  const items = await getCart(buyerId);
  if (items.length === 0) return { orders: [], total: 0 };
  const orders = [];
  let total = 0;
  for (const item of items) {
    const linePrice = Number(item.price) * item.quantity;
    total += linePrice;
    const pickupCode = String(Math.floor(1000 + Math.random() * 9000));
    const order = await sql`
      INSERT INTO orders (buyer_id, dish_id, quantity, total_price, status, pickup_code)
      VALUES (${buyerId}, ${item.id}, ${item.quantity}, ${linePrice}, 'placed', ${pickupCode})
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
