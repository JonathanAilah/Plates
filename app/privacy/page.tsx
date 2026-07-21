import Link from 'next/link';
import { TERMS_EFFECTIVE_DATE } from '@/lib/legal';

export const metadata = {
  title: 'Privacy Policy · Plates',
  description: 'Privacy Policy for Plates.',
};

const C = {
  page: '#eae4d9',
  surface: '#f7f3ec',
  ink: '#2a2320',
  inkSoft: '#4a4038',
  muted: '#8a7f70',
  terracotta: '#c8552b',
};
const font = { serif: 'Zilla Slab, serif', sans: 'DM Sans, sans-serif' };

export default function PrivacyPage() {
  return (
    <div style={{ background: C.page, minHeight: '100vh', fontFamily: font.sans, color: C.ink }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: C.surface, minHeight: '100vh', padding: '30px 24px 60px' }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/" style={{ display: 'inline-block', color: C.terracotta, font: `500 13px ${font.sans}`, textDecoration: 'none' }}>
            ← Back to Plates
          </Link>
        </div>

        <h1 style={{ font: `600 32px ${font.serif}`, color: C.ink, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 32 }}>
          Effective {TERMS_EFFECTIVE_DATE}
        </p>

        <div style={{ background: '#fff9e6', border: '1px solid #f0d67a', borderRadius: 10, padding: 14, marginBottom: 32, font: `400 13px/1.5 ${font.sans}`, color: '#7a5c0b' }}>
          <strong>Placeholder notice:</strong> This document is a plain-language placeholder for the Plates beta. It is not legal advice. Before public launch and to comply with GDPR, CCPA, and other regional privacy laws, Plates recommends having this reviewed by a lawyer.
        </div>

        <Section title="1. What we collect">
          <p>When you use Plates, we collect:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
            <li><strong>Account info:</strong> Your name, email, and (for cooks) legal name and kitchen name. Provided by you at signup.</li>
            <li><strong>Profile info:</strong> Bio, photo, dietary flags, kitchen environment, cooking hours, pickup instructions. Provided by you.</li>
            <li><strong>Location:</strong> Your home address (if you provide it) and your device&apos;s GPS when you use the location-based feed or map. Coordinates are stored to compute distance; approximate location is displayed to other users.</li>
            <li><strong>Order history:</strong> What you ordered, from whom, when, and pickup details.</li>
            <li><strong>Messages:</strong> Chat messages you send in order threads.</li>
            <li><strong>Reviews and posts:</strong> Ratings, comments, and community feed content.</li>
            <li><strong>Payment info:</strong> Handled entirely by Stripe. Plates never sees your full card number.</li>
            <li><strong>Technical data:</strong> IP address, browser type, device type, and app usage patterns (for debugging and improvement).</li>
          </ul>
        </Section>

        <Section title="2. How we use your info">
          <p>We use your info to:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
            <li>Operate the Plates marketplace (match buyers and cooks, process orders)</li>
            <li>Show your dishes, posts, and reviews to other users</li>
            <li>Compute proximity for the feed and dish listings</li>
            <li>Send you order updates and account notifications</li>
            <li>Improve the app based on usage patterns</li>
            <li>Enforce our terms of service and prevent fraud</li>
          </ul>
          <p>We do not sell your personal data to third parties.</p>
        </Section>

        <Section title="3. Who sees your info">
          <p><strong>Other users:</strong> Other users see your name, avatar, cook profile (if you&apos;re a cook), posts, reviews, and approximate location. They do NOT see your email, phone, home address, or payment info.</p>
          <p><strong>Third-party services we use:</strong></p>
          <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
            <li><strong>Clerk:</strong> handles user authentication</li>
            <li><strong>Neon (PostgreSQL):</strong> stores our database</li>
            <li><strong>Vercel:</strong> hosts the app</li>
            <li><strong>Google Maps:</strong> displays maps and pickup addresses; sees your location when you use the map</li>
            <li><strong>Stripe:</strong> processes payments (future)</li>
            <li><strong>OpenAI:</strong> generates dish photos for cooks who opt in</li>
          </ul>
          <p>Each of these has their own privacy policy. Plates only shares the minimum data needed for the service to function.</p>
        </Section>

        <Section title="4. Your rights">
          <p>You can:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
            <li>Edit your profile info at any time in the app</li>
            <li>Delete your posts and reviews from within the app</li>
            <li>Request account deletion by contacting support. We will delete your personal info within 30 days, subject to legal retention requirements (e.g. transaction records for tax purposes).</li>
            <li>Request a copy of your data by contacting support.</li>
          </ul>
          <p>If you are in the EU or UK, you have additional rights under GDPR. If you are in California, you have rights under CCPA. Contact support to exercise them.</p>
        </Section>

        <Section title="5. Cookies and tracking">
          <p>Plates uses cookies for:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
            <li>Keeping you signed in (Clerk sets authentication cookies)</li>
            <li>Remembering session state within the app</li>
            <li>Loading maps (Google Maps sets cookies)</li>
          </ul>
          <p>We do not currently use marketing or analytics cookies. If we add them in the future, we will update this policy and provide a cookie consent choice.</p>
        </Section>

        <Section title="6. Data retention">
          <p>We keep your data as long as your account is active. If you delete your account, we delete your personal data within 30 days, except:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
            <li>Transaction records (kept 7 years for tax purposes)</li>
            <li>Data that we&apos;re legally required to preserve</li>
          </ul>
          <p>Community posts expire and are hard-deleted from our database 24 hours after they were posted.</p>
        </Section>

        <Section title="7. Security">
          <p>We take reasonable measures to protect your data: encrypted connections (HTTPS), secure authentication (Clerk), and access controls. No system is perfectly secure. If a breach affects you, we will notify you as required by law.</p>
        </Section>

        <Section title="8. Children">
          <p>Plates is not intended for anyone under 18. We do not knowingly collect data from children. If you believe a child has an account, contact support and we will delete it.</p>
        </Section>

        <Section title="9. Changes">
          <p>We may update this policy. Material changes will be flagged in the app and we&apos;ll ask you to re-accept the terms if the change affects your rights.</p>
        </Section>

        <Section title="10. Contact">
          <p>Questions about this policy can be sent to support (email in the app footer).</p>
        </Section>

        <p style={{ font: `400 12px ${font.sans}`, color: C.muted, marginTop: 40, borderTop: '1px solid #e0d6c1', paddingTop: 20 }}>
          For our Terms of Service, see <Link href="/terms" style={{ color: C.terracotta }}>/terms</Link>.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ font: `500 20px ${font.serif}`, color: C.ink, marginBottom: 12 }}>{title}</h2>
      <div style={{ font: `400 14px/1.7 ${font.sans}`, color: C.inkSoft }}>{children}</div>
    </div>
  );
}
