import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { callHandler } from './handlers/call.handler.js';
import { conversationHandler } from './handlers/conversation.handler.js';
import { embedHandler, smsApiHandler } from './handlers/tools.handler.js';

const PORT = parseInt(process.env.VOICE_SERVER_PORT || '8080', 10);

async function start() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Twilio webhook — returns TwiML with ConversationRelay
  fastify.post('/voice/incoming', callHandler);

  // WebSocket endpoint for ConversationRelay
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, conversationHandler);
  });

  // Internal APIs (called by Supabase Edge Functions)
  fastify.post('/api/embed', embedHandler);
  fastify.post('/api/sms', smsApiHandler);

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Voice server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
