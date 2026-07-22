import webpush from 'web-push';
import { getPushSubscriptions, deletePushSubscription } from './db';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Sends a push notification to every device a user has subscribed on.
// Automatically cleans up subscriptions that are no longer valid
// (e.g. the cook uninstalled the PWA or cleared browser data).
export async function sendPushToUser(
  userId: number,
  payload: { title: string; body: string; url?: string }
) {
  const subscriptions = await getPushSubscriptions(userId);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (error: any) {
        // 410 Gone / 404 Not Found mean the subscription is dead — remove it.
        if (error.statusCode === 410 || error.statusCode === 404) {
          await deletePushSubscription(sub.endpoint);
        } else {
          console.error('Push send error:', error);
        }
      }
    })
  );
}