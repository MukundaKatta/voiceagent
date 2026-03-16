-- Enable realtime for calls and appointments
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
