import { supabase } from '@/integrations/supabase/client';

export interface DocumentShare {
  id: string;
  document_id: string;
  shared_by: string;
  shared_with: string;
  permission_level: 'read' | 'comment' | 'edit' | 'admin';
  shared_at: string;
  expires_at?: string;
  is_active: boolean;
  user?: {
    email: string;
    user_metadata?: { name?: string };
  };
}

export interface ShareLink {
  id: string;
  document_id: string;
  share_token: string;
  permission_level: 'read' | 'comment' | 'edit';
  requires_auth: boolean;
  max_uses?: number;
  used_count: number;
  expires_at?: string;
  created_at: string;
  is_active: boolean;
}

export interface SharedDocument {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  share_permission: string;
  shared_by_email: string;
  owner_name?: string;
}

export class DocumentSharingService {
  private static instance: DocumentSharingService;
  
  public static getInstance(): DocumentSharingService {
    if (!DocumentSharingService.instance) {
      DocumentSharingService.instance = new DocumentSharingService();
    }
    return DocumentSharingService.instance;
  }

  /**
   * Share a document with a user by email
   */
  async shareDocumentWithUser(
    documentId: string,
    email: string,
    permissionLevel: 'read' | 'comment' | 'edit' | 'admin'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // First, check if user exists
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        return { success: false, error: 'User not found with that email address' };
      }

      // Create the share
      const { error: shareError } = await supabase
        .from('document_shares')
        .insert({
          document_id: documentId,
          shared_with: userData.id,
          permission_level: permissionLevel
        });

      if (shareError) {
        if (shareError.code === '23505') {
          return { success: false, error: 'Document is already shared with this user' };
        }
        throw shareError;
      }

      return { success: true };
    } catch (error) {
      console.error('Error sharing document:', error);
      return { success: false, error: 'Failed to share document' };
    }
  }

  /**
   * Get all shares for a document
   */
  async getDocumentShares(documentId: string): Promise<DocumentShare[]> {
    try {
      const { data, error } = await supabase
        .from('document_shares')
        .select(`
          *,
          user:shared_with(email, user_metadata)
        `)
        .eq('document_id', documentId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading document shares:', error);
      return [];
    }
  }

  /**
   * Get all documents shared with the current user
   */
  async getSharedWithMeDocuments(): Promise<SharedDocument[]> {
    try {
      const { data, error } = await supabase
        .from('document_shares')
        .select(`
          permission_level,
          shared_at,
          document:documents(
            id,
            title,
            content,
            created_at,
            updated_at,
            user:user_id(email, user_metadata)
          ),
          shared_by_user:shared_by(email, user_metadata)
        `)
        .eq('is_active', true)
        .order('shared_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(share => ({
        id: share.document.id,
        title: share.document.title,
        content: share.document.content,
        user_id: share.document.user_id,
        created_at: share.document.created_at,
        updated_at: share.document.updated_at,
        share_permission: share.permission_level,
        shared_by_email: share.shared_by_user.email,
        owner_name: share.document.user?.user_metadata?.name
      }));
    } catch (error) {
      console.error('Error loading shared documents:', error);
      return [];
    }
  }

  /**
   * Get documents shared by the current user
   */
  async getSharedByMeDocuments(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('document_shares')
        .select(`
          permission_level,
          shared_at,
          document:documents(id, title, created_at),
          shared_with_user:shared_with(email, user_metadata)
        `)
        .eq('is_active', true)
        .order('shared_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading shared by me documents:', error);
      return [];
    }
  }

  /**
   * Update permission level for a share
   */
  async updateSharePermission(
    shareId: string,
    newPermission: 'read' | 'comment' | 'edit' | 'admin'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('document_shares')
        .update({ permission_level: newPermission })
        .eq('id', shareId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating share permission:', error);
      return { success: false, error: 'Failed to update permission' };
    }
  }

  /**
   * Remove document share
   */
  async removeDocumentShare(shareId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('document_shares')
        .update({ is_active: false })
        .eq('id', shareId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error removing document share:', error);
      return { success: false, error: 'Failed to remove share' };
    }
  }

  /**
   * Create a shareable link
   */
  async createShareLink(
    documentId: string,
    permissionLevel: 'read' | 'comment' | 'edit',
    options: {
      requiresAuth?: boolean;
      expiresAt?: Date;
      maxUses?: number;
    } = {}
  ): Promise<{ success: boolean; shareToken?: string; error?: string }> {
    try {
      const shareToken = this.generateRandomToken();
      
      const { error } = await supabase
        .from('document_share_links')
        .insert({
          document_id: documentId,
          share_token: shareToken,
          permission_level: permissionLevel,
          requires_auth: options.requiresAuth ?? true,
          expires_at: options.expiresAt?.toISOString(),
          max_uses: options.maxUses
        });

      if (error) throw error;
      return { success: true, shareToken };
    } catch (error) {
      console.error('Error creating share link:', error);
      return { success: false, error: 'Failed to create share link' };
    }
  }

  /**
   * Get share links for a document
   */
  async getDocumentShareLinks(documentId: string): Promise<ShareLink[]> {
    try {
      const { data, error } = await supabase
        .from('document_share_links')
        .select('*')
        .eq('document_id', documentId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading share links:', error);
      return [];
    }
  }

  /**
   * Access document via share link
   */
  async accessDocumentViaLink(shareToken: string): Promise<{
    success: boolean;
    document?: any;
    permission?: string;
    error?: string;
  }> {
    try {
      // Get the share link
      const { data: linkData, error: linkError } = await supabase
        .from('document_share_links')
        .select(`
          *,
          document:documents(*)
        `)
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single();

      if (linkError || !linkData) {
        return { success: false, error: 'Invalid or expired share link' };
      }

      // Check if link has expired
      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        return { success: false, error: 'Share link has expired' };
      }

      // Check usage limits
      if (linkData.max_uses && linkData.used_count >= linkData.max_uses) {
        return { success: false, error: 'Share link usage limit exceeded' };
      }

      // Increment usage count
      await supabase
        .from('document_share_links')
        .update({ used_count: linkData.used_count + 1 })
        .eq('id', linkData.id);

      return {
        success: true,
        document: linkData.document,
        permission: linkData.permission_level
      };
    } catch (error) {
      console.error('Error accessing document via link:', error);
      return { success: false, error: 'Failed to access document' };
    }
  }

  /**
   * Revoke a share link
   */
  async revokeShareLink(linkId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('document_share_links')
        .update({ is_active: false })
        .eq('id', linkId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error revoking share link:', error);
      return { success: false, error: 'Failed to revoke share link' };
    }
  }

  /**
   * Check user's permission for a document
   */
  async getUserDocumentPermission(documentId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_document_permission', {
          doc_id: documentId,
          user_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;
      return data || 'none';
    } catch (error) {
      console.error('Error checking document permission:', error);
      return 'none';
    }
  }

  /**
   * Check if user has access to a document
   */
  async hasDocumentAccess(
    documentId: string,
    requiredPermission: 'read' | 'comment' | 'edit' | 'admin' = 'read'
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('user_has_document_access', {
          doc_id: documentId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          required_permission: requiredPermission
        });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking document access:', error);
      return false;
    }
  }

  /**
   * Get all accessible documents (owned + shared)
   */
  async getAllAccessibleDocuments(): Promise<any[]> {
    try {
      const [ownedDocs, sharedDocs] = await Promise.all([
        this.getOwnedDocuments(),
        this.getSharedWithMeDocuments()
      ]);

      return [
        ...ownedDocs.map(doc => ({ ...doc, access_type: 'owner', permission: 'admin' })),
        ...sharedDocs.map(doc => ({ ...doc, access_type: 'shared', permission: doc.share_permission }))
      ];
    } catch (error) {
      console.error('Error loading accessible documents:', error);
      return [];
    }
  }

  private async getOwnedDocuments(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading owned documents:', error);
      return [];
    }
  }

  private generateRandomToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => 
      byte.toString(16).padStart(2, '0')
    ).join('');
  }
}

// Export default instance
export const documentSharingService = DocumentSharingService.getInstance();