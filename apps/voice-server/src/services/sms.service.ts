import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export class SmsService {
  async send(to: string, body: string, from?: string): Promise<void> {
    try {
      await client.messages.create({
        to,
        from: from || process.env.TWILIO_PHONE_NUMBER!,
        body,
      });
    } catch (error) {
      console.error('SMS send failed:', error);
      throw error;
    }
  }
}
