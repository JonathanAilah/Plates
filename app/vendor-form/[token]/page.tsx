import type { Metadata } from 'next';
import VendorMenuForm from '@/components/VendorMenuForm';

// Public page a festival/venue owner sends to a vendor so the vendor can
// build their own menu — no Plates account needed, the token is the key.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Build your menu · Plates',
  description: 'Add your menu so event-goers can skip the line and order from their phone.',
};

export default function VendorFormPage({ params }: { params: { token: string } }) {
  return <VendorMenuForm token={params.token} />;
}
