-- Collaborative Editing and Version History Schema
-- Migration for real-time document collaboration and comprehensive version tracking

-- Enable real-time for collaborative features
ALTER publication supabase_realtime ADD TABLE documents;

-- Document Versions Table - Continuous version history
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_delta JSONB, -- YJS document state for incremental updates
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  change_summary TEXT,
  is_auto_save BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  
  -- Ensure version numbers are sequential per document
  UNIQUE(document_id, version_number)
);

-- Document Snapshots Table - Named save points for important milestones
CREATE TABLE IF NOT EXISTS document_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL, -- "Draft for client review", "Final version", etc.
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_locked BOOLEAN DEFAULT false, -- Prevent further editing
  export_settings JSONB DEFAULT '{}', -- PDF export configurations
  metadata JSONB DEFAULT '{}'
);

-- Document Changes Table - Detailed audit trail
CREATE TABLE IF NOT EXISTS document_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  change_type VARCHAR(50) NOT NULL, -- 'insert', 'delete', 'format', 'replace'
  change_position INTEGER, -- Character position in document
  change_length INTEGER, -- Length of change
  old_content TEXT, -- Content before change
  new_content TEXT, -- Content after change
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id UUID, -- Track editing sessions
  metadata JSONB DEFAULT '{}'
);

-- Collaborative Sessions Table - Track active editing sessions
CREATE TABLE IF NOT EXISTS collaborative_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cursor_position INTEGER DEFAULT 0,
  selection_start INTEGER,
  selection_end INTEGER,
  user_color VARCHAR(7), -- Hex color for user identification
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Document Locks Table - Prevent conflicts during critical editing
CREATE TABLE IF NOT EXISTS document_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  lock_type VARCHAR(50) NOT NULL, -- 'exclusive', 'section', 'snapshot'
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Version Exports Table - Track exported snapshots
CREATE TABLE IF NOT EXISTS version_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES document_snapshots(id) ON DELETE CASCADE,
  export_type VARCHAR(50) NOT NULL, -- 'pdf', 'docx', 'html'
  export_url TEXT, -- Storage URL for generated file
  exported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  exported_by UUID REFERENCES auth.users(id),
  download_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

-- Add indexes for performance
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX idx_document_versions_created_at ON document_versions(created_at);
CREATE INDEX idx_document_snapshots_document_id ON document_snapshots(document_id);
CREATE INDEX idx_document_changes_document_id ON document_changes(document_id);
CREATE INDEX idx_document_changes_timestamp ON document_changes(timestamp);
CREATE INDEX idx_collaborative_sessions_document_id ON collaborative_sessions(document_id);
CREATE INDEX idx_collaborative_sessions_active ON collaborative_sessions(document_id, is_active);

-- Functions for version management

-- Auto-increment version numbers
CREATE OR REPLACE FUNCTION increment_document_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the next version number for this document
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO NEW.version_number 
  FROM document_versions 
  WHERE document_id = NEW.document_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment version numbers
CREATE TRIGGER trigger_increment_document_version
  BEFORE INSERT ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION increment_document_version();

-- Function to clean up old sessions
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS void AS $$
BEGIN
  UPDATE collaborative_sessions 
  SET is_active = false, session_end = NOW()
  WHERE is_active = true 
  AND last_activity < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- Function to get document with latest version
CREATE OR REPLACE FUNCTION get_document_with_latest_version(doc_id UUID)
RETURNS TABLE(
  document_id UUID,
  title TEXT,
  content TEXT,
  version_number INTEGER,
  last_modified TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title::TEXT,
    COALESCE(dv.content, d.content)::TEXT,
    COALESCE(dv.version_number, 0),
    COALESCE(dv.created_at, d.created_at)
  FROM documents d
  LEFT JOIN document_versions dv ON d.id = dv.document_id
  WHERE d.id = doc_id
  AND (dv.version_number = (
    SELECT MAX(version_number) 
    FROM document_versions 
    WHERE document_id = doc_id
  ) OR dv.version_number IS NULL)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborative_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_versions
CREATE POLICY "Users can view versions of their documents" ON document_versions
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create versions for their documents" ON document_versions
  FOR INSERT WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for document_snapshots
CREATE POLICY "Users can view snapshots of their documents" ON document_snapshots
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create snapshots for their documents" ON document_snapshots
  FOR INSERT WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for collaborative_sessions
CREATE POLICY "Users can view collaborative sessions for their documents" ON collaborative_sessions
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sessions for documents they can access" ON collaborative_sessions
  FOR INSERT WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own sessions" ON collaborative_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- Enable realtime for collaborative features
ALTER publication supabase_realtime ADD TABLE document_versions;
ALTER publication supabase_realtime ADD TABLE document_snapshots;
ALTER publication supabase_realtime ADD TABLE document_changes;
ALTER publication supabase_realtime ADD TABLE collaborative_sessions;

-- Add collaborative editing fields to existing documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS collaborative_state JSONB DEFAULT '{}';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_collaboration_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing documents to be collaborative-ready
UPDATE documents 
SET is_collaborative = true, 
    collaborative_state = '{"initialized": true}'
WHERE collaborative_state IS NULL OR collaborative_state = '{}';

COMMENT ON TABLE document_versions IS 'Stores continuous version history for all document changes';
COMMENT ON TABLE document_snapshots IS 'Named save points for important document milestones';
COMMENT ON TABLE document_changes IS 'Detailed audit trail of all document modifications';
COMMENT ON TABLE collaborative_sessions IS 'Tracks active editing sessions for real-time collaboration';
COMMENT ON TABLE document_locks IS 'Prevents editing conflicts during critical operations';
COMMENT ON TABLE version_exports IS 'Tracks exported document versions and their access';