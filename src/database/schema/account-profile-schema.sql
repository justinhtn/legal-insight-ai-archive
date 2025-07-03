-- Account/Profile Schema for Legal Document Manager
-- This schema implements a multi-tenant architecture where:
-- - Accounts are the billing/organization entity
-- - Profiles are individual users within an account
-- - Documents belong to accounts, not individual profiles
-- - All profiles in an account can access all documents

-- =====================================================
-- ACCOUNTS TABLE
-- =====================================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE, -- URL-friendly identifier (e.g., 'smith-law-firm')
    
    -- Billing Information
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'trial', -- trial, active, canceled, past_due
    subscription_plan VARCHAR(50) DEFAULT 'starter', -- starter, professional, enterprise
    trial_ends_at TIMESTAMPTZ,
    
    -- Account Limits (based on plan)
    max_profiles INTEGER DEFAULT 1,
    max_storage_gb INTEGER DEFAULT 10,
    max_documents INTEGER DEFAULT 100,
    
    -- Account Settings
    settings JSONB DEFAULT '{}',
    features JSONB DEFAULT '{"collaborative_editing": true, "version_history": false}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Profile Information
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
    title VARCHAR(255), -- "Senior Partner", "Associate", etc.
    
    -- Permissions (can override based on role)
    permissions JSONB DEFAULT '{
        "can_create_documents": true,
        "can_edit_documents": true,
        "can_delete_documents": false,
        "can_manage_profiles": false,
        "can_manage_billing": false
    }',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES profiles(id),
    
    -- Ensure one user can only have one profile per account
    UNIQUE(account_id, user_id)
);

-- =====================================================
-- DOCUMENTS TABLE (Updated)
-- =====================================================
-- Update the existing documents table to belong to accounts
ALTER TABLE documents 
ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
ADD COLUMN created_by_profile_id UUID REFERENCES profiles(id),
ADD COLUMN last_edited_by_profile_id UUID REFERENCES profiles(id);

-- Migrate existing documents to accounts (you'd need to handle this based on your data)
-- UPDATE documents SET account_id = (SELECT account_id FROM profiles WHERE user_id = documents.user_id LIMIT 1);

-- =====================================================
-- COLLABORATIVE SESSIONS (Now properly implemented)
-- =====================================================
CREATE TABLE collaborative_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Session Info
    connection_id VARCHAR(255), -- For tracking WebSocket connections
    cursor_position JSONB, -- {line: 10, column: 5}
    selection_range JSONB, -- {start: {line: 10, column: 5}, end: {line: 10, column: 15}}
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    
    -- Appearance
    user_color VARCHAR(7), -- Hex color for cursor/selection
    
    UNIQUE(document_id, profile_id)
);

-- =====================================================
-- DOCUMENT VERSIONS (Properly implemented)
-- =====================================================
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    
    -- Version Content
    content TEXT NOT NULL,
    content_delta JSONB, -- For storing operational transforms if needed
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_profile_id UUID REFERENCES profiles(id),
    change_summary TEXT,
    is_auto_save BOOLEAN DEFAULT false,
    
    UNIQUE(document_id, version_number)
);

-- =====================================================
-- DOCUMENT ACTIVITY LOG
-- =====================================================
CREATE TABLE document_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id),
    
    -- Activity Details
    action VARCHAR(50) NOT NULL, -- created, edited, viewed, commented, deleted
    details JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_profiles_account_id ON profiles(account_id);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_documents_account_id ON documents(account_id);
CREATE INDEX idx_collaborative_sessions_document_id ON collaborative_sessions(document_id);
CREATE INDEX idx_collaborative_sessions_profile_id ON collaborative_sessions(profile_id);
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX idx_document_activity_account_id ON document_activity(account_id);
CREATE INDEX idx_document_activity_document_id ON document_activity(document_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Profiles can only see profiles in their account
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles can view other profiles in their account" ON profiles
    FOR SELECT USING (
        account_id IN (
            SELECT account_id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Documents are accessible to all profiles in the account
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles can view documents in their account" ON documents
    FOR SELECT USING (
        account_id IN (
            SELECT account_id FROM profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Profiles can create documents in their account" ON documents
    FOR INSERT WITH CHECK (
        account_id IN (
            SELECT account_id FROM profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Profiles can update documents in their account" ON documents
    FOR UPDATE USING (
        account_id IN (
            SELECT account_id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get current profile for a user in an account
CREATE OR REPLACE FUNCTION get_current_profile(p_account_id UUID)
RETURNS profiles AS $$
BEGIN
    RETURN (
        SELECT * FROM profiles 
        WHERE user_id = auth.uid() 
        AND account_id = p_account_id
        AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has permission in account
CREATE OR REPLACE FUNCTION has_permission(p_account_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_profile profiles;
BEGIN
    v_profile := get_current_profile(p_account_id);
    
    IF v_profile IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check role-based permissions first
    IF v_profile.role = 'owner' OR v_profile.role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Check specific permission
    RETURN (v_profile.permissions->p_permission)::boolean;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Track document activity
CREATE OR REPLACE FUNCTION track_document_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_profile_id UUID;
BEGIN
    -- Determine action
    IF TG_OP = 'INSERT' THEN
        v_action := 'created';
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'edited';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'deleted';
    END IF;
    
    -- Get profile ID
    v_profile_id := COALESCE(NEW.last_edited_by_profile_id, NEW.created_by_profile_id);
    
    -- Insert activity record
    INSERT INTO document_activity (account_id, document_id, profile_id, action)
    VALUES (COALESCE(NEW.account_id, OLD.account_id), COALESCE(NEW.id, OLD.id), v_profile_id, v_action);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_document_changes
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION track_document_activity();

-- =====================================================
-- SAMPLE DATA / SETUP FUNCTIONS
-- =====================================================

-- Function to create a new account with owner profile
CREATE OR REPLACE FUNCTION create_account_with_owner(
    p_account_name VARCHAR(255),
    p_owner_name VARCHAR(255)
)
RETURNS accounts AS $$
DECLARE
    v_account accounts;
    v_profile profiles;
BEGIN
    -- Create account
    INSERT INTO accounts (name, created_by)
    VALUES (p_account_name, auth.uid())
    RETURNING * INTO v_account;
    
    -- Create owner profile
    INSERT INTO profiles (account_id, user_id, display_name, role)
    VALUES (v_account.id, auth.uid(), p_owner_name, 'owner')
    RETURNING * INTO v_profile;
    
    RETURN v_account;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;