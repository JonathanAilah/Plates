// Server-only. Gets the current authenticated user based on the Clerk session.
// Never accepts a userId from client input — that's how we prevent user impersonation.

import { auth, currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId, createUserFromClerk } from './db';

// Returns the Postgres user row for the currently signed-in Clerk user.
// Auto-creates the profile on first sign-in.
// Returns null if no one is signed in.
export async function getSessionUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  // Fast path: already have a profile
  let user = await getUserByClerkId(clerkUserId);
  if (user) return user;

  // First sign-in: create their profile
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const name =
    clerkUser.firstName ||
    clerkUser.username ||
    clerkUser.emailAddresses[0]?.emailAddress?.split('@')[0] ||
    'You';
  const email =
    clerkUser.emailAddresses[0]?.emailAddress ||
    `clerk_${clerkUserId}@plates.local`;
  const avatar = (name[0] || 'U').toUpperCase();

  user = await createUserFromClerk(clerkUserId, name, email, avatar);
  return user;
}

// Convenience: throw a 401 error if not signed in. Use in API routes that require auth.
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    const err: any = new Error('Not signed in');
    err.status = 401;
    throw err;
  }
  return user;
}

// Guard for admin-only endpoints (chief admin — full access)
export async function requireAdmin() {
  const user = await requireSessionUser();
  if (user.role !== 'admin') {
    const err: any = new Error('Admin only');
    err.status = 403;
    throw err;
  }
  return user;
}

// Staff tiers:
//   'admin'           — chief admin, sees and does everything
//   'secondary_admin' — everything except financials, pricing, and role/user management
//   'support'         — customer service: bug reports only
export type StaffRole = 'admin' | 'secondary_admin' | 'support';
export const STAFF_ROLES: StaffRole[] = ['admin', 'secondary_admin', 'support'];

// Guard for endpoints any staff member may reach. Per-action tier checks
// happen in the route handler using the returned user's role.
export async function requireStaff() {
  const user = await requireSessionUser();
  if (!STAFF_ROLES.includes(user.role)) {
    const err: any = new Error('Staff only');
    err.status = 403;
    throw err;
  }
  return user;
}
