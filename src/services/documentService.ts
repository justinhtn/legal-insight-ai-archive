
import { supabase } from '@/integrations/supabase/client';

export interface DocumentUploadData {
  fileName: string;
  fileType: string;
  fileSize: number;
  content: string;
  title?: string;
}

export const uploadDocument = async (documentData: DocumentUploadData) => {
  const { data, error } = await supabase.functions.invoke('process-document', {
    body: documentData
  });

  if (error) {
    throw new Error(`Failed to process document: ${error.message}`);
  }

  return data;
};

export const getDocuments = async () => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return data;
};

export const deleteDocument = async (documentId: string) => {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
};
