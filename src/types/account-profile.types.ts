// Account and Profile Types for Multi-Tenant Architecture

export type SubscriptionStatus = 'trial' | 'active' | 'canceled' | 'past_due';
export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise';
export type ProfileRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Account {
  id: string;
  name: string;
  slug?: string;
  
  // Billing
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status: SubscriptionStatus;
  subscription_plan: SubscriptionPlan;
  trial_ends_at?: string;
  
  // Limits
  max_profiles: number;
  max_storage_gb: number;
  max_documents: number;
  
  // Settings
  settings: Record<string, any>;
  features: {
    collaborative_editing: boolean;
    version_history: boolean;
    [key: string]: boolean;
  };
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ProfilePermissions {
  can_create_documents: boolean;
  can_edit_documents: boolean;
  can_delete_documents: boolean;
  can_manage_profiles: boolean;
  can_manage_billing: boolean;
}

export interface Profile {
  id: string;
  account_id: string;
  user_id: string;
  
  // Info
  display_name: string;
  role: ProfileRole;
  title?: string;
  
  // Permissions
  permissions: ProfilePermissions;
  
  // Status
  is_active: boolean;
  last_active_at: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  invited_by?: string;
  
  // Relations
  account?: Account;
  user?: {
    email: string;
    user_metadata?: any;
  };
}

export interface CollaborativeSession {
  id: string;
  document_id: string;
  profile_id: string;
  
  // Session Info
  connection_id?: string;
  cursor_position?: {
    line: number;
    column: number;
  };
  selection_range?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  
  // Status
  is_active: boolean;
  joined_at: string;
  last_activity: string;
  
  // Appearance
  user_color: string;
  
  // Relations
  profile?: Profile;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  
  // Content
  content: string;
  content_delta?: any;
  
  // Metadata
  created_at: string;
  created_by_profile_id: string;
  change_summary?: string;
  is_auto_save: boolean;
  
  // Relations
  created_by_profile?: Profile;
}

export interface DocumentActivity {
  id: string;
  account_id: string;
  document_id: string;
  profile_id: string;
  
  // Activity
  action: 'created' | 'edited' | 'viewed' | 'commented' | 'deleted';
  details: Record<string, any>;
  
  // Timestamp
  created_at: string;
  
  // Relations
  profile?: Profile;
  document?: {
    id: string;
    name: string;
  };
}

// Helper type for document with account context
export interface DocumentWithAccount {
  id: string;
  name: string;
  content: string;
  account_id: string;
  created_by_profile_id: string;
  last_edited_by_profile_id?: string;
  created_at: string;
  updated_at: string;
  
  // Relations
  account?: Account;
  created_by_profile?: Profile;
  last_edited_by_profile?: Profile;
  active_sessions?: CollaborativeSession[];
  versions?: DocumentVersion[];
}