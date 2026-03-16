import { google } from 'googleapis';
import { supabase } from './supabase.service.js';

export class CalendarService {
  private async getAuthClient(orgId: string) {
    // In production, retrieve OAuth tokens from org settings
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single();

    const tokens = (org?.settings as any)?.google_tokens;
    if (tokens) {
      oauth2Client.setCredentials(tokens);
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
        },
      });

      return response.data.id || null;
    } catch (error) {
      console.error('Calendar event creation failed:', error);
      return null;
    }
  }
}
