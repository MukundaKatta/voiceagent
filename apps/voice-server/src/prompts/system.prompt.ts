import type { Organization } from '@voiceagent/shared';
import { getVerticalPrompt } from './verticals/index.js';

export function buildSystemPrompt(
  org: Organization,
  knowledge: Array<{ title: string; content: string }>
): string {
  const verticalContext = getVerticalPrompt(org.vertical);
  const knowledgeContext = knowledge.length > 0
    ? `\n\nRelevant Knowledge:\n${knowledge.map((k) => `- ${k.title}: ${k.content}`).join('\n')}`
    : '';

  return `You are ${org.name}'s AI receptionist. ${verticalContext}

Business Info:
- Name: ${org.name}
- Hours: ${org.business_hours ? formatBusinessHours(org.business_hours) : 'Not specified'}
- Timezone: ${org.timezone}
- Language: ${org.language}

${org.greeting_prompt || ''}

Rules:
1. Be warm, professional, and concise — this is a phone call, not a chat
2. Keep responses under 2 sentences unless explaining something detailed
3. If asked about something not in your knowledge base, say you'll have someone follow up
4. For emergencies matching keywords [${org.emergency_keywords?.join(', ') || 'none'}], immediately use the transfer_call tool
5. Always confirm appointments by repeating the date, time, and service
6. At the end of the call, ask if there's anything else you can help with
7. Never make up information — only use the provided knowledge base
8. If the caller wants to speak to a human, use the transfer_call tool
${knowledgeContext}`;
}

function formatBusinessHours(hours: Record<string, any>): string {
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return days
    .map((day) => {
      const h = hours[day];
      if (!h) return `${day}: Closed`;
      return `${day}: ${h.open}-${h.close}`;
    })
    .join(', ');
}
