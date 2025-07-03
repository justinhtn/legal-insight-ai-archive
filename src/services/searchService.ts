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
  relevant_span?: string | null;
  legal_metadata?: any;
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

// Extract document references from AI response with improved parsing
function extractDocumentReferences(aiResponse: string) {
  console.log('Extracting document references from AI response:', aiResponse);
  
  // Multiple patterns to catch different reference formats
  const patterns = [
    /Document:\s*([^|]+)\s*\|\s*Section:\s*([^|]+)\s*\|\s*Lines:\s*([^\n\r.]+)/gi,
    /Document:\s*([^|]+)\s*\|\s*Page\s*(\d+)/gi,
    /\(([^)]+\.(?:pdf|doc|docx|txt))[^)]*\)/gi, // Match (filename.ext) patterns
    /according to ([^,.\n]+\.(?:pdf|doc|docx|txt))/gi // Match "according to filename" patterns
  ];
  
  const references = [];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(aiResponse)) !== null) {
      if (pattern.source.includes('Document:')) {
        references.push({
          document: match[1]?.trim(),
          section: match[2]?.trim(),
          lines: match[3]?.trim()
        });
      } else if (pattern.source.includes('Page')) {
        references.push({
          document: match[1]?.trim(),
          page: match[2]?.trim()
        });
      } else {
        references.push({
          document: match[1]?.trim()
        });
      }
    }
  });
  
  console.log('Extracted references:', references);
  return references;
}

// Advanced query relevance calculation based on semantic matching
function calculateSemanticRelevance(content: string, userQuery: string, aiResponse: string): number {
  console.log('Calculating semantic relevance for:', { contentPreview: content.substring(0, 100), userQuery });
  
  const queryLower = userQuery.toLowerCase();
  const contentLower = content.toLowerCase();
  const aiResponseLower = aiResponse.toLowerCase();
  
  let relevanceScore = 0;
  
  // 1. Direct answer correlation - check if content contains answers mentioned in AI response
  const aiKeyPhrases = extractKeyPhrasesFromAI(aiResponse);
  aiKeyPhrases.forEach(phrase => {
    if (contentLower.includes(phrase.toLowerCase())) {
      relevanceScore += 0.4; // High weight for AI-mentioned content
    }
  });
  
  // 2. Question-specific matching
  const questionWords = extractQuestionWords(queryLower);
  questionWords.forEach(word => {
    if (contentLower.includes(word)) {
      relevanceScore += 0.2;
    }
  });
  
  // 3. Context matching - look for related terms
  const contextTerms = getContextTerms(queryLower);
  contextTerms.forEach(term => {
    if (contentLower.includes(term)) {
      relevanceScore += 0.1;
    }
  });
  
  // 4. Exact phrase matching
  if (contentLower.includes(queryLower)) {
    relevanceScore += 0.3;
  }
  
  const finalScore = Math.min(relevanceScore, 1.0);
  console.log('Calculated relevance score:', finalScore);
  return finalScore;
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

// Extract meaningful words from the user's question
function extractQuestionWords(query: string): string[] {
  const stopWords = ['what', 'were', 'the', 'is', 'are', 'was', 'how', 'when', 'where', 'who', 'which', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  return query.split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .map(word => word.replace(/[^\w]/g, ''));
}

// Get context terms related to the query
function getContextTerms(query: string): string[] {
  const contextMap = {
    'age': ['minor', 'child', 'years', 'old', 'born', 'birth'],
    'minor': ['child', 'children', 'custody', 'age', 'years'],
    'child': ['minor', 'custody', 'age', 'support', 'children'],
    'contract': ['agreement', 'terms', 'clause', 'provision'],
    'payment': ['money', 'amount', 'fee', 'cost', 'price'],
    'date': ['when', 'time', 'signed', 'executed']
  };
  
  const terms = [];
  Object.keys(contextMap).forEach(key => {
    if (query.includes(key)) {
      terms.push(...contextMap[key]);
    }
  });
  
  return terms;
}

// Generate targeted highlights using LLM-extracted spans - UPDATED
function generateSpanBasedHighlights(userQuery: string, chunks: SearchResult[]): Array<{
  page?: number;
  text: string;
  lines?: string;
  section?: string;
  queryRelevance: number;
  legal_metadata?: any;
}> {
  console.log('Generating span-based highlights from LLM-extracted spans');
  console.log('Input chunks for span generation:', chunks.length);
  
  const chunksWithSpans = chunks.filter(chunk => chunk.relevant_span);
  console.log('Chunks with relevant spans:', chunksWithSpans.length);
  
  chunksWithSpans.forEach((chunk, i) => {
    console.log(`Chunk ${i + 1} span:`, chunk.relevant_span);
  });
  
  const highlights = chunksWithSpans.map(chunk => {
    const section = detectSection(chunk.content);
    
    return {
      page: chunk.page_number,
      text: chunk.relevant_span!, // Use the LLM-extracted span
      lines: chunk.line_start && chunk.line_end ? `${chunk.line_start}-${chunk.line_end}` : undefined,
      section: section,
      queryRelevance: 1.0, // High relevance since LLM extracted it
      legal_metadata: chunk.legal_metadata
    };
  });
  
  console.log('Generated highlights:', highlights.length);
  return highlights;
}

// Extract the most relevant part of content based on query and AI response
function extractMostRelevantText(content: string, userQuery: string, aiResponse: string): string {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Score each sentence
  const scoredSentences = sentences.map(sentence => ({
    text: sentence.trim(),
    relevance: calculateSemanticRelevance(sentence, userQuery, aiResponse)
  }))
  .filter(s => s.relevance > 0.1)
  .sort((a, b) => b.relevance - a.relevance);
  
  // Return the most relevant sentence(s)
  if (scoredSentences.length > 0) {
    const topSentences = scoredSentences.slice(0, 2);
    return topSentences.map(s => s.text).join('. ');
  }
  
  // Fallback to first part of content
  return content.substring(0, 200) + (content.length > 200 ? '...' : '');
}

// Detect section information from content
function detectSection(content: string): string | undefined {
  // Look for various section patterns
  const patterns = [
    /(?:Section|SECTION)\s*(\d+(?:\.\d+)?)\s*:?\s*([^.\n]+)/i,
    /(?:Article|ARTICLE)\s*(\d+(?:\.\d+)?)\s*:?\s*([^.\n]+)/i,
    /(?:Part|PART)\s*(\w+)\s*:?\s*([^.\n]+)/i,
    /^\s*(\d+\.\s*[A-Z][^.\n]+)/m // Numbered headings
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      if (match[2]) {
        return `${match[1]}: ${match[2].trim()}`;
      } else {
        return match[1].trim();
      }
    }
  }
  
  return undefined;
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
  console.log('Consolidating search results with span-based highlighting');
  console.log('Input chunks:', chunks.length);
  console.log('Sample chunk spans:', chunks.slice(0, 3).map(c => ({ id: c.document_id, span: c.relevant_span })));
  
  const documentMap = new Map<string, {
    document_id: string;
    document_title: string;
    document_file_name: string;
    client: string;
    matter: string;
    excerpts: Array<{ page?: number; text: string; lines?: string; section?: string; queryRelevance?: number; legal_metadata?: any }>;
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

  // Convert to array and calculate relevance with span-based highlights
  const result = Array.from(documentMap.values()).map(doc => {
    const docChunks = chunks.filter(chunk => chunk.document_id === doc.document_id);
    const spanBasedHighlights = userQuery 
      ? generateSpanBasedHighlights(userQuery, docChunks)
      : extractKeyPhrases(docChunks[0]?.content || '', docChunks[0]?.page_number, docChunks[0]?.line_start, docChunks[0]?.line_end);
    
    console.log(`Document ${doc.document_title}: Generated ${spanBasedHighlights.length} span highlights`);
    
    return {
      ...doc,
      relevance: calculateRelevanceLevel(doc.relevance_scores),
      excerpts: spanBasedHighlights.slice(0, 3) // Top 3 most relevant excerpts
    };
  });
  
  console.log('Final consolidated results:', result.length);
  return result;
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
