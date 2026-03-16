import Stripe from 'stripe';
import { supabase } from './supabase.service.js';
import { calculateMinutesBilled, PLAN_LIMITS, OVERAGE_RATE_CENTS } from '@voiceagent/shared';
import type { Plan } from '@voiceagent/shared';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true })
  : null;

export class AnalyticsService {
  /**
   * Record call minutes for an org, update usage, and report overage to Stripe.
   */
  async recordCallMinutes(orgId: string, durationSeconds: number): Promise<void> {
    const minutes = calculateMinutesBilled(durationSeconds);

    // Atomically increment minutes_used
    const { data: org } = await supabase.rpc('increment_minutes_used', {
      p_org_id: orgId,
      p_minutes: minutes,
    });

    // Re-fetch to get current state
    const { data: orgData } = await supabase
      .from('organizations')
      .select('minutes_used, minutes_limit, plan, stripe_subscription_id, stripe_customer_id')
      .eq('id', orgId)
      .single();

    if (!orgData) return;

    const planLimit = PLAN_LIMITS[orgData.plan as Plan]?.minutes ?? 200;

    // Check if over limit (planLimit of -1 means unlimited)
    if (planLimit > 0 && orgData.minutes_used > planLimit) {
      const overageMinutes = orgData.minutes_used - planLimit;
      await this.reportOverageToStripe(orgData, overageMinutes);
    }

    // Log usage event for analytics
    await this.updateDailyAnalytics(orgId, durationSeconds);
  }

  /**
   * Report overage minutes to Stripe as a metered usage record.
   */
  private async reportOverageToStripe(
    org: { stripe_subscription_id: string | null; stripe_customer_id: string | null },
    overageMinutes: number
  ): Promise<void> {
    if (!stripe || !org.stripe_subscription_id) return;

    try {
      // Find the metered price item on the subscription
      const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      const meteredItem = subscription.items.data.find(
        (item) => item.price.recurring?.usage_type === 'metered'
      );

      if (meteredItem) {
        await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
          quantity: overageMinutes,
          timestamp: Math.floor(Date.now() / 1000),
          action: 'set', // Set total overage, not increment
        });
      }
    } catch (error) {
      console.error('Stripe usage reporting failed:', error);
    }
  }

  /**
   * Update daily analytics rollup for the current day.
   */
  private async updateDailyAnalytics(orgId: string, durationSeconds: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Try to get existing record
    const { data: existing } = await supabase
      .from('call_analytics')
      .select('*')
      .eq('org_id', orgId)
      .eq('date', today)
      .single();

    if (existing) {
      const totalCalls = existing.total_calls + 1;
      const totalDuration = (existing.avg_duration_seconds || 0) * existing.total_calls + durationSeconds;

      await supabase
        .from('call_analytics')
        .update({
          total_calls: totalCalls,
          answered_calls: existing.answered_calls + 1,
          avg_duration_seconds: totalDuration / totalCalls,
          total_minutes: (existing.total_minutes || 0) + Math.ceil(durationSeconds / 60),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('call_analytics').insert({
        org_id: orgId,
        date: today,
        total_calls: 1,
        answered_calls: 1,
        avg_duration_seconds: durationSeconds,
        total_minutes: Math.ceil(durationSeconds / 60),
      });
    }
  }

  /**
   * Reset monthly minutes at billing cycle start.
   */
  async resetMonthlyMinutes(orgId: string): Promise<void> {
    await supabase
      .from('organizations')
      .update({ minutes_used: 0 })
      .eq('id', orgId);
  }
}
