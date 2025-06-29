
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  document_id: string;
  document_title: string;
  document_file_name: string;
  content: string;
  similarity: number;
  chunk_index: number;
}

export const searchDocuments = async (query: string): Promise<SearchResult[]> => {
  const { data, error } = await supabase.functions.invoke('search-documents', {
    body: { query }
  });

  if (error) {
    throw new Error(`Failed to search documents: ${error.message}`);
  }

  return data.results || [];
};
