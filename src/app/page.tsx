import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  await connection();
  const session = await getSession();
  if (session.userId) {
    redirect('/dashboard');
  }
  redirect('/login');
}
