import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUser, updateUserSeller, initializeDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { action, name, email, avatar, id, isSeller } = await request.json();

    if (action === 'create') {
      const user = await createUser(name, email, avatar);
      return NextResponse.json(user);
    }

    if (action === 'get') {
      const user = await getUser(id);
      return NextResponse.json(user);
    }

    if (action === 'toggleSeller') {
      const user = await updateUserSeller(id, isSeller);
      return NextResponse.json(user);
    }

    if (action === 'init') {
      await initializeDatabase();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('User API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
