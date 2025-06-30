
import { supabase } from '@/integrations/supabase/client';

export const getDocumentContent = async (documentId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('documents')
    .select('content')
    .eq('id', documentId)
    .single();

  if (error) {
    console.error('Error fetching document content:', error);
    throw new Error(`Failed to fetch document content: ${error.message}`);
  }

  return data?.content || '';
};
