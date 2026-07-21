import Link from 'next/link';
import { TERMS_EFFECTIVE_DATE } from '@/lib/legal';

export const metadata = {
  title: 'Terms of Service · Plates',
  description: 'Terms of Service for using Plates.',
};

// Design tokens — same as main app
const C = {
  page: '#eae4d9',
  surface: '#f7f3ec',
  card: '#fdfbf6',
  cardAlt: '#efe8db',
  ink: '#2a2320',
  inkSoft: '#4a4038',
  muted: '#8a7f70',
  terracotta: '#c8552b',
};
const font = { serif: 'Zilla Slab, serif', sans: 'DM Sans, sans-serif' };

export default function TermsPage() {
  return (
    <div style={{ background: C.page, minHeight: '100vh', fontFamily: font.sans, color: C.ink }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: C.surface, minHeight: '100vh', padding: '30px 24px 60px' }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/" style={{ display: 'inline-block', color: C.terracotta, font: `500 13px ${font.sans}`, textDecoration: 'none' }}>
            ← Back to Plates
          </Link>
        </div>

        <h1 style={{ font: `600 32px ${font.serif}`, color: C.ink, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 32 }}>
          Effective {TERMS_EFFECTIVE_DATE}
        </p>

        <div style={{ background: '#fff9e6', border: '1px solid #f0d67a', borderRadius: 10, padding: 14, marginBottom: 32, font: `400 13px/1.5 ${font.sans}`, color: '#7a5c0b' }}>
          <strong>Placeholder notice:</strong> This document is a plain-language placeholder written by the Plates team for its beta period. It is not legal advice and does not create a binding contract to the extent that would be created by professionally drafted terms. Plates recommends reviewing this with a lawyer before public launch.
        </div>

        <Section title="1. What Plates is">
          <p>Plates is a peer-to-peer marketplace where home cooks offer meals for pickup by nearby buyers. Plates is not the seller of any food, does not prepare food, and does not deliver food. Plates provides the software that connects cooks and buyers.</p>
        </Section>

        <Section title="2. Who can use Plates">
          <p>You must be at least 18 years old to use Plates. By using Plates you represent that you meet this requirement.</p>
          <p>You must provide accurate account information and keep it updated.</p>
          <p>Plates may suspend or terminate your account at any time if you violate these terms or if we believe you pose a risk to other users.</p>
        </Section>

        <Section title="3. Buying food on Plates">
          <p>When you order a meal, you are entering into a transaction with the cook, not with Plates. Plates helps facilitate the transaction and handles payment processing.</p>
          <p><strong>You accept that home-cooked food from strangers carries risk.</strong> You are responsible for reading dish descriptions, allergen information, and kitchen conditions before ordering. Plates does not verify that any given meal is safe for your individual dietary needs.</p>
          <p>If a cook fails to deliver your order, you can request a refund through the app. Plates will attempt to mediate but is not obligated to compensate you beyond refunding the transaction.</p>
        </Section>

        <Section title="4. Selling food on Plates">
          <p>Cooks must be approved by Plates admins before posting dishes. Approval requires you to attest that you comply with your local cottage food or home kitchen regulations.</p>
          <p><strong>You are solely responsible for the safety, legality, and quality of the food you sell.</strong> This includes proper food handling, accurate allergen labeling, and compliance with all applicable health, tax, and licensing requirements in your jurisdiction.</p>
          <p>You agree to indemnify Plates against any claims arising from food you prepare or sell through the platform, including foodborne illness, allergic reactions, or regulatory violations.</p>
          <p>Plates takes a platform fee on each transaction. The current rate is disclosed at checkout. Plates may adjust the fee with reasonable notice.</p>
        </Section>

        <Section title="5. Community posts">
          <p>Posts you make in the Plates community feed are your own. You retain ownership of your content but grant Plates a license to display it in the app.</p>
          <p>Plates removes posts that violate our content rules: no illegal content, hate speech, harassment, spam, or content that endangers others.</p>
          <p>Posts automatically expire after 24 hours.</p>
        </Section>

        <Section title="6. Payments and refunds">
          <p>Payments are processed by Stripe on behalf of the cook. Plates does not directly hold funds. Refunds, when granted, are processed back to your original payment method through Stripe.</p>
          <p>Once a cook has begun preparing an order, cancellations may not be eligible for a full refund. Plates admins may make judgment calls in dispute cases.</p>
        </Section>

        <Section title="7. Prohibited items">
          <p>You may not use Plates to sell:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
            <li>Alcoholic beverages</li>
            <li>Cannabis or CBD products</li>
            <li>Raw or undercooked meat, fish, poultry, or eggs intended to be consumed raw</li>
            <li>Any food that is illegal to prepare or sell in your jurisdiction</li>
            <li>Any non-food item</li>
          </ul>
        </Section>

        <Section title="8. Limitation of liability">
          <p>PLATES IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, PLATES DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE.</p>
          <p>PLATES WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING FOODBORNE ILLNESS OR OTHER HARM CAUSED BY MEALS PURCHASED THROUGH THE PLATFORM.</p>
          <p>PLATES' TOTAL LIABILITY FOR ANY CLAIM WILL NOT EXCEED THE AMOUNT YOU PAID TO PLATES IN THE 12 MONTHS BEFORE THE CLAIM.</p>
        </Section>

        <Section title="9. Changes to these terms">
          <p>Plates may update these terms. When we make material changes, we will notify you in the app and require you to re-accept before continuing to use Plates.</p>
        </Section>

        <Section title="10. Contact">
          <p>Questions about these terms can be sent to support (email in the app footer).</p>
        </Section>

        <p style={{ font: `400 12px ${font.sans}`, color: C.muted, marginTop: 40, borderTop: '1px solid #e0d6c1', paddingTop: 20 }}>
          For our Privacy Policy, see <Link href="/privacy" style={{ color: C.terracotta }}>/privacy</Link>.
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
