
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
    queryRelevance?: number;
  }>;
  total_pages?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  consolidated_documents: ConsolidatedDocument[];
  ai_response?: string;
  message?: string;
}

// Extract document references from AI response
function extractDocumentReferences(aiResponse: string) {
  const referencePattern = /Document:\s*([^|]+)\s*\|\s*Section:\s*([^|]+)\s*\|\s*Lines:\s*([^\n]+)/g;
  const references = [];
  let match;
  
  while ((match = referencePattern.exec(aiResponse)) !== null) {
    references.push({
      document: match[1].trim(),
      section: match[2].trim(),
      lines: match[3].trim()
    });
  }
  
  return references;
}

// Calculate relevance of content to user query
function calculateQueryRelevance(content: string, userQuery: string): number {
  const queryWords = userQuery.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const contentWords = content.toLowerCase().split(/\s+/);
  
  let matches = 0;
  queryWords.forEach(queryWord => {
    if (contentWords.some(contentWord => contentWord.includes(queryWord) || queryWord.includes(contentWord))) {
      matches++;
    }
  });
  
  return queryWords.length > 0 ? matches / queryWords.length : 0;
}

// Generate targeted highlights based on query relevance
function generateTargetedHighlights(userQuery: string, aiResponse: string, chunks: SearchResult[]): Array<{
  page?: number;
  text: string;
  lines?: string;
  section?: string;
  queryRelevance: number;
}> {
  // Extract AI-referenced sections
  const referencedSections = extractDocumentReferences(aiResponse);
  
  // Find chunks that match AI references or are highly relevant to query
  const relevantChunks = chunks.map(chunk => ({
    ...chunk,
    queryRelevance: calculateQueryRelevance(chunk.content, userQuery)
  }))
  .filter(chunk => chunk.queryRelevance > 0.3) // Only include relevant content
  .sort((a, b) => b.queryRelevance - a.queryRelevance)
  .slice(0, 3); // Top 3 most relevant chunks
  
  return relevantChunks.map(chunk => {
    // Try to extract section information from content
    const sectionMatch = chunk.content.match(/(?:Section|SECTION)\s*(\d+(?:\.\d+)?)\s*:?\s*([^.\n]+)/i);
    const section = sectionMatch ? `Section ${sectionMatch[1]}: ${sectionMatch[2].trim()}` : undefined;
    
    return {
      page: chunk.page_number,
      text: chunk.content.trim(),
      lines: chunk.line_start && chunk.line_end ? `${chunk.line_start}-${chunk.line_end}` : undefined,
      section: section,
      queryRelevance: chunk.queryRelevance
    };
  });
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

function consolidateSearchResults(chunks: SearchResult[], userQuery: string = '', aiResponse: string = ''): ConsolidatedDocument[] {
  const documentMap = new Map<string, {
    document_id: string;
    document_title: string;
    document_file_name: string;
    client: string;
    matter: string;
    excerpts: Array<{ page?: number; text: string; lines?: string; section?: string; queryRelevance?: number }>;
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

    const docData = documentMap.get(docId)!;
    docData.relevance_scores.push(chunk.similarity);
  });

  // Convert to array and calculate relevance with targeted highlights
  return Array.from(documentMap.values()).map(doc => {
    const docChunks = chunks.filter(chunk => chunk.document_id === doc.document_id);
    const targetedHighlights = userQuery && aiResponse 
      ? generateTargetedHighlights(userQuery, aiResponse, docChunks)
      : extractKeyPhrases(docChunks[0]?.content || '', docChunks[0]?.page_number, docChunks[0]?.line_start, docChunks[0]?.line_end);
    
    return {
      ...doc,
      relevance: calculateRelevanceLevel(doc.relevance_scores),
      excerpts: targetedHighlights.slice(0, 3) // Limit to top 3 most relevant excerpts
    };
  });
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
  const consolidated_documents = consolidateSearchResults(results, query, data.ai_response);

  return {
    results,
    consolidated_documents,
    ai_response: data.ai_response,
    message: data.message
  };
};
