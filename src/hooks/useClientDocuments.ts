
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientDocument {
  id: string;
  name: string;
  file_type: string;
  size: number;
  created_at: string;
  folder_id?: string;
}

export const useClientDocuments = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client-documents', clientId],
    queryFn: async (): Promise<ClientDocument[]> => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, file_name, file_type, file_size, created_at, folder_id')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching client documents:', error);
        throw new Error(`Failed to fetch documents: ${error.message}`);
      }

      return (data || []).map(doc => ({
        id: doc.id,
        name: doc.title || doc.file_name,
        file_type: doc.file_type,
        size: doc.file_size || 0,
        created_at: doc.created_at,
        folder_id: doc.folder_id
      }));
    },
    enabled: !!clientId,
  });
};
