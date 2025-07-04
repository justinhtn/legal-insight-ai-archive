import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SharedDocument {
  id: string;
  name: string;
  file_type: string;
  size: number;
  created_at: string;
  folder_id?: string;
  sharedPermission: string;
  client_name?: string;
}

export const useSharedDocuments = () => {
  return useQuery({
    queryKey: ['shared-documents'],
    queryFn: async (): Promise<SharedDocument[]> => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;
      
      console.log('🔥 === useSharedDocuments DEBUG START ===');
      console.log('🔥 User:', user?.id);
      console.log('🔥 User email:', userEmail);
      console.log('🔥 Hook is running!');
      
      if (!userEmail || !user) {
        console.log('No user or email, returning empty array');
        return [];
      }
      
      let sharedDocs: any[] = [];
      
      // Simplified approach: First get share records, then get documents separately
      try {
        console.log('Getting basic share records for email:', userEmail);
        
        // Step 1: Get all document_shares records (including shared_with_email column)
        const { data: allShares, error: shareError } = await supabase
          .from('document_shares')
          .select('document_id, metadata, permission_level, shared_with, shared_with_email')
          .eq('is_active', true);
        
        if (shareError) {
          console.error('Failed to get share records:', shareError);
          return [];
        }
        
        console.log('Total share records found:', allShares.length);
        
        // Step 2: Filter shares for this user (by UUID, shared_with_email column, or metadata email)
        const userShares = allShares.filter(share => {
          // Check UUID match
          if (share.shared_with === user.id) {
            console.log('Found UUID match for share:', share.document_id);
            return true;
          }
          
          // Check shared_with_email column match
          if (share.shared_with_email === userEmail) {
            console.log('Found shared_with_email column match for share:', share.document_id, 'email:', share.shared_with_email);
            return true;
          }
          
          // Check metadata email match (fallback)
          if (share.metadata && share.metadata.shared_with_email === userEmail) {
            console.log('Found metadata email match for share:', share.document_id);
            return true;
          }
          
          return false;
        });
        
        console.log('Shares for current user:', userShares.length);
        
        if (userShares.length === 0) {
          console.log('No shares found for user');
          return [];
        }
        
        // Step 3: Get the actual documents for these shares
        const documentIds = userShares.map(share => share.document_id);
        console.log('Fetching documents with IDs:', documentIds);
        
        const { data: documents, error: docError } = await supabase
          .from('documents')
          .select('id, title, file_name, file_type, file_size, created_at, folder_id, user_id, client_id')
          .in('id', documentIds);
        
        if (docError) {
          console.error('Failed to get documents:', docError);
          return [];
        }
        
        console.log('Documents found:', documents.length);
        
        // Step 4: Combine shares with documents
        sharedDocs = userShares.map(share => {
          const doc = documents.find(d => d.id === share.document_id);
          return {
            documents: doc,
            permission_level: share.permission_level,
            document_id: share.document_id
          };
        }).filter(item => item.documents); // Only include items where we found the document
        
        console.log('Final shared docs with document data:', sharedDocs.length);
        
      } catch (e) {
        console.error('Simplified sharing query failed:', e);
      }

      // Remove duplicates
      const uniqueDocs = sharedDocs.filter((doc, index, self) => 
        index === self.findIndex(d => d.document_id === doc.document_id)
      );

      console.log('Total unique shared documents found:', uniqueDocs.length);
      console.log('Shared documents:', uniqueDocs);
      console.log('=== useSharedDocuments DEBUG END ===');

      return uniqueDocs.map(share => ({
        id: share.documents.id,
        name: share.documents.title || share.documents.file_name,
        file_type: share.documents.file_type,
        size: share.documents.file_size || 0,
        created_at: share.documents.created_at,
        folder_id: share.documents.folder_id,
        sharedPermission: share.permission_level,
        client_name: 'Shared Document' // Will get client name separately if needed
      }));
    },
  });
};