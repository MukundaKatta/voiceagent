-- Demo organization
INSERT INTO organizations (id, name, slug, vertical, phone_number, timezone, plan, minutes_limit, greeting_prompt, emergency_keywords)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Amogha Cafe',
  'amogha-cafe',
  'restaurant',
  '+17025551234',
  'America/Los_Angeles',
  'growth',
  500,
  'You are the AI receptionist for Amogha Cafe, a popular Indian restaurant in Las Vegas. You are warm, friendly, and knowledgeable about our menu.',
  ARRAY['fire', 'emergency', 'ambulance', '911']
);

-- Demo knowledge base
INSERT INTO knowledge_base (org_id, title, content, category) VALUES
('00000000-0000-0000-0000-000000000001', 'Business Hours', 'Amogha Cafe is open Monday-Thursday 11am-9pm, Friday-Saturday 11am-10pm, Sunday 12pm-8pm.', 'hours'),
('00000000-0000-0000-0000-000000000001', 'Location', 'We are located at 1234 S Las Vegas Blvd, Las Vegas, NV 89101. Free parking available.', 'general'),
('00000000-0000-0000-0000-000000000001', 'Popular Dishes', 'Our most popular dishes include Butter Chicken ($16.99), Biryani ($14.99), and Dosa ($12.99). We also have a lunch buffet for $13.99.', 'menu'),
('00000000-0000-0000-0000-000000000001', 'Reservations', 'We accept reservations for parties of 4 or more. Walk-ins are welcome for smaller parties. For large events (20+), please call to discuss.', 'reservations');
