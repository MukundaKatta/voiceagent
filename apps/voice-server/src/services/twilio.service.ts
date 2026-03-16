import twilio from 'twilio';
import { supabase } from './supabase.service.js';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export class TwilioService {
  /**
   * Search for available phone numbers in a given area code or region.
   */
  async searchNumbers(areaCode?: string, country = 'US', limit = 5) {
    const search = client.availablePhoneNumbers(country).local;
    const options: Record<string, unknown> = {
      voiceEnabled: true,
      smsEnabled: true,
      limit,
    };
    if (areaCode) options.areaCode = areaCode;

    const numbers = await search.list(options);
    return numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
    }));
  }

  /**
   * Purchase a phone number and configure webhooks for voice.
   */
  async provisionNumber(phoneNumber: string, orgId: string): Promise<string> {
    const voiceUrl = process.env.VOICE_SERVER_URL
      ? `${process.env.VOICE_SERVER_URL}/voice/incoming`
      : '';
    const statusUrl = process.env.VOICE_SERVER_URL
      ? `${process.env.VOICE_SERVER_URL}/voice/status`
      : '';

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl,
      voiceMethod: 'POST',
      statusCallback: statusUrl,
      statusCallbackMethod: 'POST',
    });

    // Update organization with the new number
    await supabase
      .from('organizations')
      .update({
        phone_number: purchased.phoneNumber,
        twilio_sid: purchased.sid,
      })
      .eq('id', orgId);

    return purchased.phoneNumber;
  }

  /**
   * Release a phone number back to Twilio.
   */
  async releaseNumber(twilioSid: string): Promise<void> {
    await client.incomingPhoneNumbers(twilioSid).remove();
  }

  /**
   * Update webhook URLs for an existing number.
   */
  async updateWebhooks(twilioSid: string): Promise<void> {
    const voiceUrl = process.env.VOICE_SERVER_URL
      ? `${process.env.VOICE_SERVER_URL}/voice/incoming`
      : '';

    await client.incomingPhoneNumbers(twilioSid).update({
      voiceUrl,
      voiceMethod: 'POST',
    });
  }
}
