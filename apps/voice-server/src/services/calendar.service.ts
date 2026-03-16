import { google } from 'googleapis';
import { supabase } from './supabase.service.js';

export class CalendarService {
  private createOAuth2Client() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.VOICE_SERVER_URL}/api/calendar/callback`
    );
  }

  /**
   * Generate Google OAuth consent URL. Uses orgId as state parameter.
   */
  getAuthUrl(orgId: string): string {
    const oauth2Client = this.createOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      state: orgId,
    });
  }

  /**
   * Exchange authorization code for tokens and store in org settings.
   */
  async handleCallback(code: string, orgId: string): Promise<void> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens in org settings
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single();

    const settings = (org?.settings || {}) as Record<string, unknown>;
    settings.google_tokens = tokens;

    await supabase
      .from('organizations')
      .update({ settings })
      .eq('id', orgId);
  }

  private async getAuthClient(orgId: string) {
    const oauth2Client = this.createOAuth2Client();

    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single();

    const tokens = (org?.settings as any)?.google_tokens;
    if (tokens) {
      oauth2Client.setCredentials(tokens);

      // Handle token refresh
      oauth2Client.on('tokens', async (newTokens) => {
        const currentSettings = (org?.settings || {}) as Record<string, unknown>;
        currentSettings.google_tokens = { ...tokens, ...newTokens };
        await supabase
          .from('organizations')
          .update({ settings: currentSettings })
          .eq('id', orgId);
      });
    }

    return oauth2Client;
  }

  async checkAvailability(orgId: string, start: Date, end: Date): Promise<boolean> {
    try {
      const auth = await this.getAuthClient(orgId);
      const calendar = google.calendar({ version: 'v3', auth });

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          items: [{ id: 'primary' }],
        },
      });

      const busy = response.data.calendars?.primary?.busy || [];
      return busy.length === 0;
    } catch (error) {
      console.error('Calendar availability check failed:', error);
      return true; // Default to available if calendar isn't connected
    }
  }

  async createEvent(
    orgId: string,
    event: { summary: string; start: Date; end: Date; description?: string }
  ): Promise<string | null> {
    try {
      const auth = await this.getAuthClient(orgId);
      const calendar = google.calendar({ version: 'v3', auth });

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.start.toISOString() },
          end: { dateTime: event.end.toISOString() },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 },
            ],
          },
        },
      });

      return response.data.id || null;
    } catch (error) {
      console.error('Calendar event creation failed:', error);
      return null;
    }
  }

  async deleteEvent(orgId: string, eventId: string): Promise<void> {
    try {
      const auth = await this.getAuthClient(orgId);
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.delete({ calendarId: 'primary', eventId });
    } catch (error) {
      console.error('Calendar event deletion failed:', error);
    }
  }
}
