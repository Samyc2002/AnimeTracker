import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { isAdmin } from '@/lib/admin';

const InventoryClient = dynamic(() => import('./inventory-client'));

export default async function InventoryPage() {
  if (!(await isAdmin())) {
    notFound();
  }

  return <InventoryClient />;
}
