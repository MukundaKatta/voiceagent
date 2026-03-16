'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Phone, BarChart3, BookOpen, Calendar, Users,
  Settings, CreditCard, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/calls', label: 'Calls', icon: Phone },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/billing', label: 'Billing', icon: CreditCard },
];

export function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      <div className="border-b p-4">
        <h1 className="text-lg font-bold">VoiceAgent</h1>
        {user?.organization && (
          <p className="text-sm text-muted-foreground">{user.organization.name}</p>
        )}
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
