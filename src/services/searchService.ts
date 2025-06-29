
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  document_id: string;
  document_title: string;
  document_file_name: string;
  content: string;
  similarity: number;
  chunk_index: number;
}

export interface SearchResponse {
  results: SearchResult[];
  ai_response?: string;
  message?: string;
}

export const searchDocuments = async (query: string): Promise<SearchResponse> => {
  const { data, error } = await supabase.functions.invoke('search-documents', {
    body: { query }
  });

  if (error) {
    throw new Error(`Failed to search documents: ${error.message}`);
  }

  return {
    results: data.results || [],
    ai_response: data.ai_response,
    message: data.message
  };
};
