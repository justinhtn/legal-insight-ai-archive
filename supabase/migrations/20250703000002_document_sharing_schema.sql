-- Document Sharing Schema
-- Allow multiple users to collaborate on the same document

-- Document Shares Table - Track who has access to which documents
CREATE TABLE IF NOT EXISTS document_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id), -- User who shared the document
  shared_with UUID NOT NULL REFERENCES auth.users(id), -- User who received access
  permission_level VARCHAR(20) DEFAULT 'read' CHECK (permission_level IN ('read', 'comment', 'edit', 'admin')),
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  
  -- Prevent duplicate shares
  UNIQUE(document_id, shared_with)
);

-- Document Share Links Table - Generate shareable links
CREATE TABLE IF NOT EXISTS document_share_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  share_token VARCHAR(255) UNIQUE NOT NULL, -- Random token for sharing
  permission_level VARCHAR(20) DEFAULT 'read' CHECK (permission_level IN ('read', 'comment', 'edit')),
  requires_auth BOOLEAN DEFAULT true, -- Whether link requires authentication
  max_uses INTEGER, -- Limit number of uses
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Team Members Table - For law firms with multiple attorneys
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL, -- Could reference a firms/organizations table
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(team_id, user_id)
);

-- Add indexes for performance
CREATE INDEX idx_document_shares_document_id ON document_shares(document_id);
CREATE INDEX idx_document_shares_shared_with ON document_shares(shared_with);
CREATE INDEX idx_document_shares_active ON document_shares(document_id, shared_with, is_active);
CREATE INDEX idx_document_share_links_token ON document_share_links(share_token);
CREATE INDEX idx_team_members_team_user ON team_members(team_id, user_id);

-- Functions for sharing

-- Check if user has access to document
CREATE OR REPLACE FUNCTION user_has_document_access(doc_id UUID, user_id UUID, required_permission TEXT DEFAULT 'read')
RETURNS BOOLEAN AS $$
BEGIN
  -- Owner always has access
  IF EXISTS (
    SELECT 1 FROM documents 
    WHERE id = doc_id AND user_id = user_has_document_access.user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check direct share
  IF EXISTS (
    SELECT 1 FROM document_shares 
    WHERE document_id = doc_id 
    AND shared_with = user_has_document_access.user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (
      permission_level = 'admin' OR
      (required_permission = 'read' AND permission_level IN ('read', 'comment', 'edit', 'admin')) OR
      (required_permission = 'comment' AND permission_level IN ('comment', 'edit', 'admin')) OR
      (required_permission = 'edit' AND permission_level IN ('edit', 'admin'))
    )
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check team access (if document owner is in same team)
  IF EXISTS (
    SELECT 1 FROM documents d
    JOIN team_members tm1 ON d.user_id = tm1.user_id
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE d.id = doc_id 
    AND tm2.user_id = user_has_document_access.user_id
    AND tm1.is_active = true 
    AND tm2.is_active = true
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's permission level for a document
CREATE OR REPLACE FUNCTION get_user_document_permission(doc_id UUID, user_id UUID)
RETURNS TEXT AS $$
DECLARE
  permission TEXT := 'none';
BEGIN
  -- Owner has admin permission
  IF EXISTS (
    SELECT 1 FROM documents 
    WHERE id = doc_id AND user_id = get_user_document_permission.user_id
  ) THEN
    RETURN 'admin';
  END IF;
  
  -- Check direct share
  SELECT permission_level INTO permission
  FROM document_shares 
  WHERE document_id = doc_id 
  AND shared_with = get_user_document_permission.user_id
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY 
    CASE permission_level 
      WHEN 'admin' THEN 4
      WHEN 'edit' THEN 3
      WHEN 'comment' THEN 2
      WHEN 'read' THEN 1
      ELSE 0
    END DESC
  LIMIT 1;
  
  IF permission IS NOT NULL THEN
    RETURN permission;
  END IF;
  
  -- Check team access (default to read for team members)
  IF EXISTS (
    SELECT 1 FROM documents d
    JOIN team_members tm1 ON d.user_id = tm1.user_id
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE d.id = doc_id 
    AND tm2.user_id = get_user_document_permission.user_id
    AND tm1.is_active = true 
    AND tm2.is_active = true
  ) THEN
    RETURN 'read';
  END IF;
  
  RETURN 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to include shared documents

-- Update documents RLS policy
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
CREATE POLICY "Users can view documents they have access to" ON documents
  FOR SELECT USING (
    user_id = auth.uid() OR
    user_has_document_access(id, auth.uid(), 'read')
  );

-- Update document_versions RLS policy
DROP POLICY IF EXISTS "Users can view versions of their documents" ON document_versions;
CREATE POLICY "Users can view versions of accessible documents" ON document_versions
  FOR SELECT USING (
    user_has_document_access(document_id, auth.uid(), 'read')
  );

DROP POLICY IF EXISTS "Users can create versions for their documents" ON document_versions;
CREATE POLICY "Users can create versions for editable documents" ON document_versions
  FOR INSERT WITH CHECK (
    user_has_document_access(document_id, auth.uid(), 'edit')
  );

-- Update document_snapshots RLS policy
DROP POLICY IF EXISTS "Users can view snapshots of their documents" ON document_snapshots;
CREATE POLICY "Users can view snapshots of accessible documents" ON document_snapshots
  FOR SELECT USING (
    user_has_document_access(document_id, auth.uid(), 'read')
  );

DROP POLICY IF EXISTS "Users can create snapshots for their documents" ON document_snapshots;
CREATE POLICY "Users can create snapshots for editable documents" ON document_snapshots
  FOR INSERT WITH CHECK (
    user_has_document_access(document_id, auth.uid(), 'edit')
  );

-- Update collaborative_sessions RLS policy
DROP POLICY IF EXISTS "Users can view collaborative sessions for their documents" ON collaborative_sessions;
CREATE POLICY "Users can view sessions for accessible documents" ON collaborative_sessions
  FOR SELECT USING (
    user_has_document_access(document_id, auth.uid(), 'read')
  );

DROP POLICY IF EXISTS "Users can create sessions for documents they can access" ON collaborative_sessions;
CREATE POLICY "Users can create sessions for accessible documents" ON collaborative_sessions
  FOR INSERT WITH CHECK (
    user_has_document_access(document_id, auth.uid(), 'read')
  );

-- RLS for sharing tables
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Document shares policies
CREATE POLICY "Users can view shares for their documents" ON document_shares
  FOR SELECT USING (
    user_has_document_access(document_id, auth.uid(), 'admin') OR
    shared_with = auth.uid()
  );

CREATE POLICY "Document owners can create shares" ON document_shares
  FOR INSERT WITH CHECK (
    user_has_document_access(document_id, auth.uid(), 'admin')
  );

CREATE POLICY "Document owners can update shares" ON document_shares
  FOR UPDATE USING (
    user_has_document_access(document_id, auth.uid(), 'admin')
  );

-- Document share links policies
CREATE POLICY "Users can view share links for their documents" ON document_share_links
  FOR SELECT USING (
    user_has_document_access(document_id, auth.uid(), 'admin')
  );

CREATE POLICY "Document owners can create share links" ON document_share_links
  FOR INSERT WITH CHECK (
    user_has_document_access(document_id, auth.uid(), 'admin')
  );

-- Team members policies
CREATE POLICY "Team members can view their team" ON team_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active = true)
  );

-- Enable realtime for sharing tables
ALTER publication supabase_realtime ADD TABLE document_shares;
ALTER publication supabase_realtime ADD TABLE document_share_links;
ALTER publication supabase_realtime ADD TABLE team_members;

-- Add sharing fields to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS default_permission VARCHAR(20) DEFAULT 'read';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS team_id UUID; -- Optional team association

COMMENT ON TABLE document_shares IS 'Direct document sharing between users';
COMMENT ON TABLE document_share_links IS 'Shareable links for document access';
COMMENT ON TABLE team_members IS 'Team/organization membership for law firms';