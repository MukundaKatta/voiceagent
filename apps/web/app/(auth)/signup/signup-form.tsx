'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return <p className="text-center text-sm">Check your email to confirm your account.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign up'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account? <a href="/login" className="underline">Sign in</a>
      </p>
    </form>
  );
}
