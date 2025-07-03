-- QUICK SHARING SCHEMA FIX
-- Copy and paste this into your Supabase SQL Editor

-- Document Shares Table
CREATE TABLE IF NOT EXISTS document_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  shared_with UUID NOT NULL REFERENCES auth.users(id),
  permission_level VARCHAR(20) DEFAULT 'read' CHECK (permission_level IN ('read', 'comment', 'edit', 'admin')),
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  UNIQUE(document_id, shared_with)
);

-- Document Share Links Table
CREATE TABLE IF NOT EXISTS document_share_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  share_token VARCHAR(255) UNIQUE NOT NULL,
  permission_level VARCHAR(20) DEFAULT 'read' CHECK (permission_level IN ('read', 'comment', 'edit')),
  requires_auth BOOLEAN DEFAULT true,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS on new tables
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_share_links ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Users can view shares for their documents" ON document_shares
  FOR SELECT USING (
    document_id IN (SELECT id FROM documents WHERE user_id = auth.uid()) OR
    shared_with = auth.uid()
  );

CREATE POLICY "Document owners can create shares" ON document_shares
  FOR INSERT WITH CHECK (
    document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
  );

-- Add sharing fields to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS default_permission VARCHAR(20) DEFAULT 'read';