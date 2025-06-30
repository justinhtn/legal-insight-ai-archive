
import { supabase } from '@/integrations/supabase/client';

export interface Document {
  id: string;
  user_id: string;
  folder_id?: string;
  name: string;
  size?: number;
  uploaded_at: string;
  file_type: string;
  content?: string;
}

export const getDocuments = async (folderId: string): Promise<Document[]> => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('folder_id', folderId)
    .order('title');

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  // Map database fields to our interface
  return (data || []).map(doc => ({
    id: doc.id,
    user_id: doc.user_id,
    folder_id: doc.folder_id,
    name: doc.title || doc.file_name,
    size: doc.file_size,
    uploaded_at: doc.created_at,
    file_type: doc.file_type,
    content: doc.content
  }));
};

export const uploadDocument = async (
  file: File, 
  clientId?: string | null, 
  folderId?: string | null
): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  
  if (clientId) {
    formData.append('client_id', clientId);
  }
  
  if (folderId) {
    formData.append('folder_id', folderId);
  }

  // Call the Supabase Edge Function for document processing
  const { data, error } = await supabase.functions.invoke('process-document', {
    body: formData,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data;
};
