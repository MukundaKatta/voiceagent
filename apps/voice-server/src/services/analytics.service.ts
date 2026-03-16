import { supabase } from './supabase.service.js';
import { calculateMinutesBilled } from '@voiceagent/shared';

export class AnalyticsService {
  async recordCallMinutes(orgId: string, durationSeconds: number): Promise<void> {
    const minutes = calculateMinutesBilled(durationSeconds);

    await supabase.rpc('increment_minutes_used', {
      p_org_id: orgId,
      p_minutes: minutes,
    });
  }
}
