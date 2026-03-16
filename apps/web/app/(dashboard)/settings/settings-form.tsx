'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VOICE_OPTIONS, SUPPORTED_LANGUAGES } from '@voiceagent/shared';

export function SettingsForm({ org }: { org: any }) {
  const [greetingPrompt, setGreetingPrompt] = useState(org?.greeting_prompt || '');
  const [voiceId, setVoiceId] = useState(org?.voice_id || 'en-US-Neural2-F');
  const [language, setLanguage] = useState(org?.language || 'en-US');
  const [transferNumber, setTransferNumber] = useState(org?.transfer_number || '');
  const [emergencyKeywords, setEmergencyKeywords] = useState(
    org?.emergency_keywords?.join(', ') || ''
  );
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    const supabase = createClient();
    const { error } = await supabase
      .from('organizations')
      .update({
        greeting_prompt: greetingPrompt || null,
        voice_id: voiceId,
        language,
        transfer_number: transferNumber || null,
        emergency_keywords: emergencyKeywords
          .split(',')
          .map((k: string) => k.trim())
          .filter(Boolean),
      })
      .eq('id', org.id);

    setLoading(false);
    if (!error) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="text-sm font-medium">AI Personality / Greeting Prompt</label>
        <textarea
          className="mt-1 flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="Describe how you want your AI receptionist to sound and behave..."
          value={greetingPrompt}
          onChange={(e) => setGreetingPrompt(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Voice</label>
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Language</label>
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Transfer Number (human fallback)</label>
        <Input
          className="mt-1"
          placeholder="+1234567890"
          value={transferNumber}
          onChange={(e) => setTransferNumber(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Emergency Keywords (comma-separated)</label>
        <Input
          className="mt-1"
          placeholder="fire, emergency, ambulance, 911"
          value={emergencyKeywords}
          onChange={(e) => setEmergencyKeywords(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">Calls mentioning these words are immediately transferred to a human.</p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </form>
  );
}
