import type { Organization } from '@voiceagent/shared';

export function getToolDefinitions(org: Organization) {
  const tools: any[] = [
    {
      toolSpec: {
        name: 'book_appointment',
        description: 'Book an appointment for the caller. Use this when someone wants to schedule a visit, reservation, or service.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              customer_name: { type: 'string', description: 'Full name of the customer' },
              customer_phone: { type: 'string', description: 'Phone number of the customer' },
              service: { type: 'string', description: 'Type of service or appointment' },
              provider: { type: 'string', description: 'Preferred provider/stylist/dentist (if any)' },
              date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
              time: { type: 'string', description: 'Time in HH:MM format (24hr)' },
              duration_minutes: { type: 'number', description: 'Duration in minutes (default 60)' },
            },
            required: ['customer_name', 'date', 'time'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'transfer_call',
        description: 'Transfer the call to a human. Use for emergencies, complex issues, or when the caller specifically asks for a person.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              reason: { type: 'string', description: 'Reason for transfer' },
            },
            required: ['reason'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'send_sms',
        description: 'Send an SMS to the caller or another number. Use for sending confirmation details, directions, or follow-up info.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Phone number to send SMS to' },
              message: { type: 'string', description: 'SMS message content' },
            },
            required: ['to', 'message'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'take_message',
        description: 'Record a message for the business owner. Use when the caller wants to leave a message.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              caller_name: { type: 'string', description: 'Name of the caller' },
              message: { type: 'string', description: 'The message content' },
              urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Message urgency' },
            },
            required: ['message'],
          },
        },
      },
    },
  ];

  return tools;
}
