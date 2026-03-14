-- Schema v14: Add knowledge_entries and positions to realtime publication
-- Required for live workspace updates during simulation

-- knowledge_entries — Memory section updates in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE knowledge_entries;

-- positions — Org chart updates in real-time (new roles, status changes)
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
