import type { Vertical } from '@voiceagent/shared';
import { restaurantPrompt } from './restaurant.js';
import { dentalPrompt } from './dental.js';
import { templePrompt } from './temple.js';
import { salonPrompt } from './salon.js';

const verticalPrompts: Record<Vertical, string> = {
  restaurant: restaurantPrompt,
  dental: dentalPrompt,
  temple: templePrompt,
  salon: salonPrompt,
  home_services: 'You specialize in home services. Help callers with scheduling repairs, getting quotes, and dispatching technicians for urgent issues.',
  general: 'You are a professional and helpful receptionist.',
};

export function getVerticalPrompt(vertical: Vertical): string {
  return verticalPrompts[vertical] || verticalPrompts.general;
}
