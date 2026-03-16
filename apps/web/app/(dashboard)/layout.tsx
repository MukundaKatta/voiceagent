import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: dbUser } = await supabase
    .from('users')
    .select('*, organization:organizations(*)')
    .eq('auth_uid', user.id)
    .single();

  return (
    <div className="flex h-screen">
      <Sidebar user={dbUser} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
