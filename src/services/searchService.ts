import { supabase } from '@/integrations/supabase/client';
import { Client, getFolders } from './clientService';
import { findRelevantSentences, AnswerRelevantSentence } from './answerMatchingService';

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
  relevance_factors?: {
    exactPhrase: number;
    semantic: number;
    context: number;
    recency: number;
    cosine: number;
    qualityFilters: {
      hasMinimumMatches: boolean;
      hasStrongSemantic: boolean;
      hasExactPhrase: boolean;
    };
  };
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

// Enhanced relevance scoring for client-side filtering
function calculateClientSideRelevance(content: string, userQuery: string, aiResponse: string): number {
  const queryLower = userQuery.toLowerCase();
  const contentLower = content.toLowerCase();
  const aiResponseLower = aiResponse.toLowerCase();
  
  let relevanceScore = 0;
  
  // 1. AI response correlation - check if content contains answers mentioned in AI response (40% weight)
  const aiKeyPhrases = extractKeyPhrasesFromAI(aiResponse);
  aiKeyPhrases.forEach(phrase => {
    if (contentLower.includes(phrase.toLowerCase())) {
      relevanceScore += 0.4;
    }
  });
  
  // 2. Direct query matching (30% weight)
  const meaningfulQueryTerms = extractMeaningfulTerms(queryLower);
  let matchedTerms = 0;
  meaningfulQueryTerms.forEach(term => {
    if (contentLower.includes(term)) {
      matchedTerms++;
    }
  });
  
  if (meaningfulQueryTerms.length > 0) {
    const matchRatio = matchedTerms / meaningfulQueryTerms.length;
    relevanceScore += matchRatio * 0.3;
  }
  
  // 3. Exact phrase matching (30% weight)
  if (contentLower.includes(queryLower)) {
    relevanceScore += 0.3;
  } else {
    // Check for partial phrase matches
    const queryPhrases = queryLower.split(/\s+/).filter(w => w.length > 3);
    let phraseMatches = 0;
    queryPhrases.forEach(phrase => {
      if (contentLower.includes(phrase)) {
        phraseMatches++;
      }
    });
    if (queryPhrases.length > 0) {
      relevanceScore += (phraseMatches / queryPhrases.length) * 0.15;
    }
  }
  
  return Math.min(relevanceScore, 1.0);
}

// Extract meaningful terms (exclude common words)
function extractMeaningfulTerms(query: string): string[] {
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'what', 'were', 'is', 'are', 'was', 'how', 'when', 'where', 'who', 'which', 'document', 'documents', 'contract', 'case']);
  
  return query.split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word))
    .map(word => word.replace(/[^\w]/g, ''));
}

// Extract key phrases that the AI mentioned in its response
function extractKeyPhrasesFromAI(aiResponse: string): string[] {
  const phrases = [];
  
  // Extract quoted content
  const quotedMatches = aiResponse.match(/"([^"]+)"/g);
  if (quotedMatches) {
    phrases.push(...quotedMatches.map(match => match.replace(/"/g, '')));
  }
  
  // Extract specific values (numbers, names, etc.)
  const valueMatches = aiResponse.match(/\b(?:age\s+)?(\d+|[A-Z][a-z]+\s+[A-Z][a-z]+|\$[\d,]+|\d+\s*years?\s*old)\b/g);
  if (valueMatches) {
    phrases.push(...valueMatches);
  }
  
  // Extract important terms
  const importantTerms = aiResponse.match(/\b(?:EMMA|JACOB|JOHNSON|minor|child|age|custody|support)\b/gi);
  if (importantTerms) {
    phrases.push(...importantTerms);
  }
  
  return phrases.filter(phrase => phrase.length > 2);
}

// Generate targeted highlights based on AI response correlation with enhanced filtering
function generateAnswerBasedHighlights(userQuery: string, aiResponse: string, chunks: SearchResult[]): Array<{
  page?: number;
  text: string;
  lines?: string;
  section?: string;
  queryRelevance: number;
}> {
  console.log('Generating answer-based highlights for AI response:', aiResponse.substring(0, 100));
  
  // Use the enhanced answer matching service
  const relevantSentences = findRelevantSentences(chunks, aiResponse, 3);
  console.log('Found relevant sentences:', relevantSentences.length);
  
  // Filter for high-quality highlights only
  return relevantSentences
    .filter(sentence => sentence.relevanceScore >= 0.6) // 60% threshold for highlights
    .map(sentence => ({
      page: sentence.page,
      text: sentence.text,
      lines: sentence.lines,
      section: sentence.section,
      queryRelevance: sentence.relevanceScore
    }));
}

function calculateRelevanceLevel(scores: number[]): 'High' | 'Medium' | 'Low' {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 0.8) return 'High';
  if (avg >= 0.7) return 'Medium';
  return 'Low';
}

function consolidateSearchResults(chunks: SearchResult[], userQuery: string = '', aiResponse: string = ''): ConsolidatedDocument[] {
  console.log('Consolidating search results with enhanced relevance filtering');
  
  const documentMap = new Map<string, {
    document_id: string;
    document_title: string;
    document_file_name: string;
    client: string;
    matter: string;
    excerpts: Array<{ page?: number; text: string; lines?: string; section?: string; queryRelevance?: number }>;
    relevance_scores: number[];
  }>();

  // Only process chunks with high relevance (70%+ from backend)
  const highRelevanceChunks = chunks.filter(chunk => chunk.similarity >= 0.7);
  
  highRelevanceChunks.forEach(chunk => {
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

  // Convert to array and calculate relevance with answer-based highlights
  return Array.from(documentMap.values())
    .filter(doc => doc.relevance_scores.length > 0) // Ensure we have data
    .map(doc => {
      const docChunks = highRelevanceChunks.filter(chunk => chunk.document_id === doc.document_id);
      const answerBasedHighlights = userQuery && aiResponse 
        ? generateAnswerBasedHighlights(userQuery, aiResponse, docChunks)
        : [];
      
      return {
        ...doc,
        relevance: calculateRelevanceLevel(doc.relevance_scores),
        excerpts: answerBasedHighlights.slice(0, 2) // Top 2 most relevant excerpts only
      };
    })
    .filter(doc => doc.excerpts.length > 0); // Only return documents with quality highlights
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
  
  // Additional client-side filtering for extra quality assurance
  const highQualityResults = results.filter(result => {
    // Ensure backend scoring was applied
    if (result.similarity < 0.7) return false;
    
    // Additional content quality checks
    if (result.content.length < 50) return false; // Minimum content length
    
    // Check for meaningful content vs just common words
    const meaningfulWords = extractMeaningfulTerms(result.content.toLowerCase());
    if (meaningfulWords.length < 3) return false;
    
    return true;
  });

  const consolidated_documents = consolidateSearchResults(highQualityResults, query, data.ai_response);

  return {
    results: highQualityResults,
    consolidated_documents,
    ai_response: data.ai_response,
    message: data.message
  };
};
