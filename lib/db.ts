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
        status VARCHAR(50) DEFAULT 'processing',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

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

export async function updateUserProfile(id: number, name: string, bio: string, photoUrl: string | null) {
  const result = await sql`
    UPDATE users SET name = ${name}, bio = ${bio}, photo_url = ${photoUrl} WHERE id = ${id} RETURNING *
  `;
  return result.rows[0];
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
           u.latitude as seller_latitude, u.longitude as seller_longitude
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
    SELECT o.*, d.name, d.emoji, u.name as seller_name
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
    SELECT o.*, d.name, d.emoji, u.name as buyer_name
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
    const order = await sql`
      INSERT INTO orders (buyer_id, dish_id, quantity, total_price)
      VALUES (${buyerId}, ${item.id}, ${item.quantity}, ${linePrice})
      RETURNING *
    `;
    orders.push(order.rows[0]);
  }
  await clearCart(buyerId);
  return { orders, total: total + tipAmount + serviceFee, subtotal: total, tip: tipAmount, fee: serviceFee };
}