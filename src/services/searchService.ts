
import { supabase } from '@/integrations/supabase/client';
import { Client, getFolders } from './clientService';

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
    section?: string;
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
  
  // Extract section information if available
  const sectionMatch = content.match(/(?:Section|SECTION)\s*(\d+(?:\.\d+)?)\s*:?\s*([^.\n]+)/i);
  const section = sectionMatch ? `Section ${sectionMatch[1]}: ${sectionMatch[2].trim()}` : undefined;
  
  // For now, take the first 2 sentences as key phrases
  const keyPhrases = sentences.slice(0, 2).map(sentence => ({
    page: pageNumber,
    text: sentence.trim(),
    lines: lineStart && lineEnd ? `${lineStart}-${lineEnd}` : undefined,
    section: section
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
    excerpts: Array<{ page?: number; text: string; lines?: string; section?: string }>;
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

export const generateClientContext = async (client: Client): Promise<string> => {
  try {
    // Get real-time folder structure
    const folders = await getFolders(client.id);
    
    const folderContext = folders.length > 0 
      ? folders.map(f => `- ${f.name}: Legal documents and files`).join('\n')
      : '- No folders created yet';
    
    return `
Client Information:
- Name: ${client.name}
- Case Type: ${client.matter_type || 'Not specified'}
- Case Number: ${client.case_number || 'Not assigned'}
- Email: ${client.email || 'Not provided'}

Available Folders:
${folderContext}

Total Folders: ${folders.length}
`;
  } catch (error) {
    console.error('Error generating client context:', error);
    return `
Client Information:
- Name: ${client.name}
- Case Type: ${client.matter_type || 'Not specified'}
- Case Number: ${client.case_number || 'Not assigned'}

Folders: Unable to load folder structure
`;
  }
};

export const searchDocuments = async (query: string, clientId?: string, client?: Client): Promise<SearchResponse> => {
  // Handle folder structure queries directly
  if (query.toLowerCase().includes('folder') && client) {
    try {
      const folders = await getFolders(client.id);
      const folderList = folders.length > 0 
        ? folders.map(f => `• ${f.name}`).join('\n')
        : 'No folders have been created yet.';
      
      const response = `${client.name} has ${folders.length} folder${folders.length !== 1 ? 's' : ''}:

${folderList}

You can organize documents by uploading them to specific folders.`;

      return {
        results: [],
        consolidated_documents: [],
        ai_response: response,
        message: `Folder structure for ${client.name}`
      };
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  }

  // Generate client context for document search
  let clientContext = '';
  if (client) {
    clientContext = await generateClientContext(client);
  }

  const { data, error } = await supabase.functions.invoke('search-documents', {
    body: { 
      query,
      client_id: clientId || null,
      client_context: clientContext
    }
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
