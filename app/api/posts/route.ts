import { NextRequest, NextResponse } from 'next/server';
import {
  createPost, getFeed, getPost, deletePost,
  togglePostReaction, getCommentsForPost, createComment,
  deleteComment, getCommentAuthor,
} from '@/lib/db';
import { getSessionUser, requireSessionUser } from '@/lib/auth';

function errorResponse(error: any) {
  const status = error?.status || 500;
  const message = error?.message || 'Internal server error';
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'feed') {
      // Public: anonymous users can browse the feed too, they just can't post/react
      const me = await getSessionUser();
      // Optional proximity filter — passed as query params
      const latParam = searchParams.get('lat');
      const lngParam = searchParams.get('lng');
      const radiusParam = searchParams.get('radiusMi');
      const lat = latParam ? parseFloat(latParam) : null;
      const lng = lngParam ? parseFloat(lngParam) : null;
      const radiusMi = radiusParam ? parseFloat(radiusParam) : null;
      // Sanity-clamp radius to prevent absurd queries
      const clampedRadius = radiusMi != null && Number.isFinite(radiusMi)
        ? Math.max(0.1, Math.min(500, radiusMi))
        : null;
      const feed = await getFeed(me?.id ?? null, lat, lng, clampedRadius);
      return NextResponse.json(feed);
    }

    if (action === 'comments') {
      const postId = parseInt(searchParams.get('postId') || '0');
      if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 });
      const comments = await getCommentsForPost(postId);
      return NextResponse.json(comments);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Posts GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireSessionUser();
    if (me.account_disabled) {
      return NextResponse.json({ error: 'Account is disabled' }, { status: 403 });
    }
    const body = await request.json();
    const { action, postId, commentId, kind, text, photoUrl } = body;

    if (action === 'create') {
      const post = await createPost(me.id, text, photoUrl ?? null);
      return NextResponse.json(post);
    }

    if (action === 'delete') {
      if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 });
      const post = await getPost(postId);
      if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      // Only the author OR an admin can delete
      if (post.user_id !== me.id && me.role !== 'admin') {
        return NextResponse.json({ error: 'Not your post' }, { status: 403 });
      }
      await deletePost(postId);
      return NextResponse.json({ success: true });
    }

    if (action === 'react') {
      if (!postId || !kind) return NextResponse.json({ error: 'postId and kind required' }, { status: 400 });
      if (!['heart', 'fire', 'hands'].includes(kind)) {
        return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
      }
      // Post must still exist (i.e. not expired)
      const post = await getPost(postId);
      if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      const result = await togglePostReaction(postId, me.id, kind);
      return NextResponse.json(result);
    }

    if (action === 'comment') {
      if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 });
      const post = await getPost(postId);
      if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      const comment = await createComment(postId, me.id, text);
      return NextResponse.json(comment);
    }

    if (action === 'deleteComment') {
      if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 });
      const authorId = await getCommentAuthor(commentId);
      if (authorId == null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      // Comment author OR admin can delete
      if (authorId !== me.id && me.role !== 'admin') {
        return NextResponse.json({ error: 'Not your comment' }, { status: 403 });
      }
      await deleteComment(commentId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Posts POST error:', error);
    return errorResponse(error);
  }
}
