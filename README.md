# Plates — Community feed (Snapchat-style)

Ephemeral 24-hour posts on the Discover screen. Text-required, photo-optional, reactions (❤️🔥🙌) + comments. Anyone signed in can post.

## What changed

**New Discover/Feed toggle at the top of the landing screen.**
Two tabs directly under the header — "Discover" (default, marketplace) and "Feed" (community posts). Selected tab underlined in terracotta. Discover stays the landing view; Feed is one tap away.

**Feed screen**
- **Composer** at the top: your avatar + textarea + "Add photo" button + Post button. 500-character limit shown live. Reminds you posts vanish after 24hr.
- **Post cards** below: author info + text + optional photo + reaction buttons + comment count. Each card shows "3h ago · 21h left" so you know how ephemeral it is.
- **Reactions** (❤️🔥🙌): tap to toggle yours. Count updates optimistically. Active reactions are shown in terracotta.
- **Comments**: tap the comment button to expand a thread under the post. Comment composer inline.
- **Cook badge**: approved cooks show a green "COOK" chip next to their name in posts.

**Auto-expiration**
- Posts have `expires_at = created_at + 24 hours`.
- `getFeed()` filters `WHERE expires_at > CURRENT_TIMESTAMP` on every read.
- `pruneExpiredPosts()` runs opportunistically on every feed load — hard-deletes expired rows (comments + reactions cascade). No cron job needed; DB stays clean.

**Photo handling**
- Client-side downscale to max 1200px longest side, 85% JPEG quality (via canvas).
- 3MB pre-processing cap to prevent huge uploads.
- Stored as base64 data URLs in Postgres — same pattern as user photos and AI-generated dish photos.

**Server-side protections**
- Text required, capped at 500 chars.
- Comments capped at 300 chars.
- Rate limiting by DB — no user can spam beyond reasonable limits, and per-post per-user per-kind unique constraint on reactions.
- Delete permissions: post author OR admin.
- Disabled accounts blocked from posting.
- Reactions on expired posts return 404 (they've been pruned).

## Files

- `lib/db.ts` — new `posts`, `post_comments`, `post_reactions` tables; feed helpers, prune query.
- `app/api/posts/route.ts` — NEW route for feed, create, react, comment, delete.
- `app/page.tsx` — Discover/Feed toggle, composer, feed cards, reactions, comments UI.

## Install

1. Extract this zip.
2. Copy files into your local Plates repo:
   - `app/api/posts/` folder is NEW
   - `lib/db.ts` — overwrite
   - `app/page.tsx` — overwrite
3. GitHub Desktop shows 3 changed files (1 new folder).
4. Commit: `Add community feed (24hr ephemeral posts + reactions + comments)`
5. Push origin — Vercel auto-deploys.

Tables are created on next app load via the migration in `initializeDatabase()`. No manual SQL.

## What to test

**As a signed-in user:**
1. Open Discover — you should see the Discover/Feed toggle at the top.
2. Tap Feed. Empty state shows: "The feed is quiet."
3. Type in the composer. Photo optional. Tap Post. Your post appears at the top of the feed with "expires in 24h".
4. Tap the ❤️ button. Count goes to 1, button turns terracotta. Tap again to remove.
5. Try 🔥 and 🙌 — you can stack multiple reactions on the same post.
6. Tap the comment button. Type a comment. Press Enter to send. Comment appears; count updates.
7. Tap the trash icon on your own post — it deletes.

**As an admin:**
8. Try to delete someone else's post — you should be able to (admin power).
9. Try to delete someone else's comment — should also work.

**Wait 24 hours (or manually run SQL to test):**
```sql
-- Force a post to be expired for testing
UPDATE posts SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = <post_id>;
```
Then refresh — the post should disappear from the feed. Then check `SELECT COUNT(*) FROM posts;` — it should be one less (cleanup on read).

## Design decisions

- **Feed is inside Discover, not a nav tab** — respects the marketplace-first mental model. Community is prominent but not primary.
- **Anonymous users see Discover only, not Feed** — posting/reacting requires an account; showing the feed just to gate every interaction with a sign-in modal is worse UX than not showing it. If they sign in, feed opens up.
- **Reactions are stacked, not exclusive** — like Discord/Slack. One post can have all 3 reactions from you if you want.
- **Optimistic UI on reactions** — count updates instantly, network happens in background. Reloads on error.
- **Poll every 20s while on Feed** — same rhythm as messaging. Battery-friendly with document.hidden check.
- **No @mentions, hashtags, or DMs from posts** — deliberate scope limit. Add later if organic behavior warrants it.

## Not built

- User profiles that show "recent posts" — posts vanish after 24hr, so a permanent profile view is a bit awkward. Skipped.
- Notifications when someone reacts/comments on your post. Notifications need infra we don't have yet.
- Photo galleries / carousels — one photo per post max.
- Video, GIFs, or emoji reactions beyond the 3 fixed kinds.
- Following/friending — the feed is global, chronological. No algorithmic ranking.
- Post reporting / abuse flag. Admins can delete posts and comments, which is enough for now.
