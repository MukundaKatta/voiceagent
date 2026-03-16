'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

export function ContactSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    router.push(`/contacts?${params.toString()}`);
  }

  return (
    <Input
      placeholder="Search by name, phone, or email..."
      className="max-w-md"
      defaultValue={searchParams.get('q') || ''}
      onChange={(e) => {
        const timeout = setTimeout(() => handleSearch(e.target.value), 500);
        return () => clearTimeout(timeout);
      }}
    />
  );
}
