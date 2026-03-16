import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { callHandler, callStatusHandler } from './handlers/call.handler.js';
import { conversationHandler } from './handlers/conversation.handler.js';
import { embedHandler, smsApiHandler } from './handlers/tools.handler.js';
import { TwilioService } from './services/twilio.service.js';
import { CalendarService } from './services/calendar.service.js';

const PORT = parseInt(process.env.VOICE_SERVER_PORT || '8080', 10);

async function start() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);
  await fastify.register(formbody); // Parse Twilio's application/x-www-form-urlencoded

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // Twilio webhooks (form-encoded POST)
  fastify.post('/voice/incoming', callHandler);
  fastify.post('/voice/status', callStatusHandler);

  // WebSocket endpoint for ConversationRelay
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, conversationHandler);
  });

  // Internal APIs (authenticated with INTERNAL_API_KEY)
  fastify.post('/api/embed', embedHandler);
  fastify.post('/api/sms', smsApiHandler);

  // Twilio number management
  const twilioService = new TwilioService();

  fastify.get('/api/numbers/search', async (request, reply) => {
    const { areaCode, country } = request.query as { areaCode?: string; country?: string };
    const authHeader = request.headers.authorization;
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const numbers = await twilioService.searchNumbers(areaCode, country);
    return { numbers };
  });

  fastify.post('/api/numbers/provision', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const { phoneNumber, orgId } = request.body as { phoneNumber: string; orgId: string };
    const provisioned = await twilioService.provisionNumber(phoneNumber, orgId);
    return { phoneNumber: provisioned };
  });

  // Full tenant setup (subaccount + number)
  fastify.post('/api/tenants/setup', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const { orgId, orgName, areaCode } = request.body as { orgId: string; orgName: string; areaCode?: string };

    // Search for a number
    const numbers = await twilioService.searchNumbers(areaCode, 'US', 1);
    if (numbers.length === 0) {
      return reply.status(404).send({ error: 'No numbers available' });
    }

    // Provision it
    const phoneNumber = await twilioService.provisionNumber(numbers[0].phoneNumber, orgId);
    return { phoneNumber, orgId };
  });

  // Google Calendar OAuth
  fastify.get('/api/calendar/oauth', async (request, reply) => {
    const { orgId } = request.query as { orgId: string };
    const calendarService = new CalendarService();
    const authUrl = calendarService.getAuthUrl(orgId);
    return reply.redirect(authUrl);
  });

  fastify.get('/api/calendar/callback', async (request, reply) => {
    const { code, state: orgId } = request.query as { code: string; state: string };
    const calendarService = new CalendarService();
    await calendarService.handleCallback(code, orgId);
    // Redirect back to dashboard settings
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    return reply.redirect(`${dashboardUrl}/settings?calendar=connected`);
  });

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Voice server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
