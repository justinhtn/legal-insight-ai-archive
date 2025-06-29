
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  document_id: string;
  document_title: string;
  document_file_name: string;
  content: string;
  similarity: number;
  chunk_index: number;
  page_number?: number;
  line_start?: number;
  line_end?: number;
  client?: string;
  matter?: string;
}

export interface ConsolidatedDocument {
  document_id: string;
  document_title: string;
  document_file_name: string;
  client: string;
  matter: string;
  relevance: 'High' | 'Medium' | 'Low';
  excerpts: Array<{
    page?: number;
    text: string;
    lines?: string;
  }>;
  total_pages?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  consolidated_documents: ConsolidatedDocument[];
  ai_response?: string;
  message?: string;
}

function extractKeyPhrases(content: string, pageNumber?: number, lineStart?: number, lineEnd?: number) {
  // Split content into sentences and take the most relevant ones
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // For now, take the first 2 sentences as key phrases
  // In a real implementation, this could use NLP to find the most relevant sentences
  const keyPhrases = sentences.slice(0, 2).map(sentence => ({
    page: pageNumber,
    text: sentence.trim(),
    lines: lineStart && lineEnd ? `Lines ${lineStart}-${lineEnd}` : undefined
  }));

  return keyPhrases;
}

function calculateRelevanceLevel(scores: number[]): 'High' | 'Medium' | 'Low' {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg > 0.6) return 'High';
  if (avg > 0.3) return 'Medium';
  return 'Low';
}

function consolidateSearchResults(chunks: SearchResult[]): ConsolidatedDocument[] {
  const documentMap = new Map<string, {
    document_id: string;
    document_title: string;
    document_file_name: string;
    client: string;
    matter: string;
    excerpts: Array<{ page?: number; text: string; lines?: string }>;
    relevance_scores: number[];
  }>();

  chunks.forEach(chunk => {
    const docId = chunk.document_id;
    
    if (!documentMap.has(docId)) {
      documentMap.set(docId, {
        document_id: docId,
        document_title: chunk.document_title,
        document_file_name: chunk.document_file_name,
        client: chunk.client || 'Unknown',
        matter: chunk.matter || 'Unknown',
        excerpts: [],
        relevance_scores: []
      });
    }

    // Extract key phrases from chunk content
    const keyPhrases = extractKeyPhrases(
      chunk.content, 
      chunk.page_number, 
      chunk.line_start, 
      chunk.line_end
    );
    
    const docData = documentMap.get(docId)!;
    docData.excerpts.push(...keyPhrases);
    docData.relevance_scores.push(chunk.similarity);
  });

  // Convert to array and calculate relevance
  return Array.from(documentMap.values()).map(doc => ({
    ...doc,
    relevance: calculateRelevanceLevel(doc.relevance_scores),
    // Remove duplicates and limit to most relevant excerpts
    excerpts: doc.excerpts
      .filter((excerpt, index, self) => 
        index === self.findIndex(e => e.text === excerpt.text)
      )
      .slice(0, 5) // Limit to top 5 excerpts per document
  }));
}

export const searchDocuments = async (query: string): Promise<SearchResponse> => {
  const { data, error } = await supabase.functions.invoke('search-documents', {
    body: { query }
  });

  if (error) {
    throw new Error(`Failed to search documents: ${error.message}`);
  }

  const results = data.results || [];
  const consolidated_documents = consolidateSearchResults(results);

  return {
    results,
    consolidated_documents,
    ai_response: data.ai_response,
    message: data.message
  };
};
