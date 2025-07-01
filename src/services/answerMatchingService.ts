import { SearchResult } from './searchService';

export interface AnswerEntity {
  type: 'name' | 'age' | 'date' | 'amount' | 'number' | 'reference';
  value: string;
  context?: string;
}

export interface AnswerRelevantSentence {
  text: string;
  relevanceScore: number;
  matchedEntities: AnswerEntity[];
  page?: number;
  lines?: string;
  section?: string;
}

// Enhanced entity extraction with better precision
export function extractAnswerEntities(aiResponse: string): AnswerEntity[] {
  const entities: AnswerEntity[] = [];
  
  // Extract names with better precision (avoid false positives)
  const nameMatches = aiResponse.match(/\b([A-Z][a-z]{2,}\s+[A-Z][A-Z]+(?:\s*,?\s*(?:age|aged)?\s*\d+)?)\b/g);
  if (nameMatches) {
    nameMatches.forEach(match => {
      const cleanName = match.replace(/\s*,?\s*(?:age|aged)?\s*\d+/gi, '').trim();
      if (cleanName.length > 3 && !isCommonWord(cleanName)) {
        entities.push({
          type: 'name',
          value: cleanName,
          context: match
        });
      }
    });
  }
  
  // Extract ages with better context
  const ageMatches = aiResponse.match(/(?:age|aged)\s*:?\s*(\d+)|(\d+)\s*(?:years?\s*old)/gi);
  if (ageMatches) {
    ageMatches.forEach(match => {
      const ageNumber = match.match(/\d+/)?.[0];
      if (ageNumber && parseInt(ageNumber) > 0 && parseInt(ageNumber) < 150) {
        entities.push({
          type: 'age',
          value: ageNumber,
          context: match
        });
      }
    });
  }
  
  // Extract dates with enhanced patterns
  const dateMatches = aiResponse.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/gi);
  if (dateMatches) {
    dateMatches.forEach(match => {
      entities.push({
        type: 'date',
        value: match,
        context: match
      });
    });
  }
  
  // Extract amounts with better validation
  const amountMatches = aiResponse.match(/\$[\d,]+(?:\.\d{2})?/g);
  if (amountMatches) {
    amountMatches.forEach(match => {
      const amount = parseFloat(match.replace(/[$,]/g, ''));
      if (amount > 0) {
        entities.push({
          type: 'amount',
          value: match,
          context: match
        });
      }
    });
  }
  
  // Extract meaningful numbers (not just any number)
  const numberMatches = aiResponse.match(/\b(?:contract|case|client|matter)\s*(?:number|#|no\.?)\s*:?\s*([A-Z0-9-]+)|\b(\d{4,})\b/gi);
  if (numberMatches) {
    numberMatches.forEach(match => {
      const numberValue = match.match(/([A-Z0-9-]+|\d{4,})$/i)?.[1];
      if (numberValue && numberValue.length >= 4) {
        entities.push({
          type: 'number',
          value: numberValue,
          context: match
        });
      }
    });
  }
  
  // Extract case/client references
  const referenceMatches = aiResponse.match(/(?:case|client|matter|file)\s*(?:number|#|no\.?)\s*:?\s*([A-Z0-9-]+)/gi);
  if (referenceMatches) {
    referenceMatches.forEach(match => {
      const refValue = match.match(/([A-Z0-9-]+)$/i)?.[1];
      if (refValue && refValue.length >= 3) {
        entities.push({
          type: 'reference',
          value: refValue,
          context: match
        });
      }
    });
  }
  
  return entities;
}

// Helper function to check if a word is too common to be meaningful
function isCommonWord(word: string): boolean {
  const commonWords = new Set(['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'HAD', 'BY', 'WORD', 'BUT', 'WHAT', 'SOME', 'IS', 'IT', 'YOU', 'OR', 'HAD', 'THE', 'OF', 'TO', 'AND', 'A', 'IN', 'IS', 'IT', 'YOU', 'THAT', 'HE', 'WAS', 'FOR', 'ON', 'ARE', 'AS', 'WITH', 'HIS', 'THEY', 'I', 'AT', 'BE', 'THIS', 'HAVE', 'FROM', 'OR', 'ONE', 'HAD', 'BY', 'WORD', 'BUT', 'NOT', 'WHAT', 'ALL', 'WERE', 'WE', 'WHEN', 'YOUR', 'CAN', 'SAID', 'THERE', 'EACH', 'WHICH', 'SHE', 'DO', 'HOW', 'THEIR', 'IF', 'WILL', 'UP', 'OTHER', 'ABOUT', 'OUT', 'MANY', 'THEN', 'THEM', 'THESE', 'SO', 'SOME', 'HER', 'WOULD', 'MAKE', 'LIKE', 'INTO', 'HIM', 'HAS', 'TWO', 'MORE', 'GO', 'NO', 'WAY', 'COULD', 'MY', 'THAN', 'FIRST', 'BEEN', 'CALL', 'WHO', 'OIL', 'ITS', 'NOW', 'FIND', 'LONG', 'DOWN', 'DAY', 'DID', 'GET', 'COME', 'MADE', 'MAY', 'PART']);
  return commonWords.has(word.toUpperCase());
}

// Enhanced sentence relevance finding with stricter scoring
export function findRelevantSentences(
  chunks: SearchResult[],
  aiResponse: string,
  maxSentences: number = 3
): AnswerRelevantSentence[] {
  const entities = extractAnswerEntities(aiResponse);
  console.log('Extracted entities from AI response:', entities);
  
  const allSentences: AnswerRelevantSentence[] = [];
  
  chunks.forEach(chunk => {
    // Only process high-relevance chunks
    if (chunk.similarity < 0.7) return;
    
    // Split content into sentences with better parsing
    const sentences = chunk.content
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 30) // Minimum sentence length
      .map(s => s.trim());
    
    sentences.forEach(sentence => {
      const matchedEntities: AnswerEntity[] = [];
      let relevanceScore = 0;
      
      // Check each entity against the sentence with enhanced scoring
      entities.forEach(entity => {
        const entityRegex = new RegExp(entity.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (entityRegex.test(sentence)) {
          matchedEntities.push(entity);
          // Enhanced scoring based on entity type and context
          switch (entity.type) {
            case 'name': 
              relevanceScore += sentence.toLowerCase().includes(entity.value.toLowerCase()) ? 0.5 : 0.3;
              break;
            case 'age': 
              relevanceScore += 0.4;
              break;
            case 'date': 
              relevanceScore += 0.4;
              break;
            case 'amount': 
              relevanceScore += 0.35;
              break;
            case 'reference': 
              relevanceScore += 0.45;
              break;
            case 'number': 
              relevanceScore += 0.25;
              break;
          }
        }
      });
      
      // Enhanced semantic similarity with AI response
      const semanticScore = calculateSemanticSimilarity(sentence, aiResponse);
      relevanceScore += semanticScore * 0.3;
      
      // Boost score for exact quoted content from AI response
      const quotedContent = aiResponse.match(/"([^"]+)"/g);
      if (quotedContent) {
        quotedContent.forEach(quote => {
          const cleanQuote = quote.replace(/"/g, '');
          if (cleanQuote.length > 10 && sentence.toLowerCase().includes(cleanQuote.toLowerCase())) {
            relevanceScore += 0.6; // High boost for exact quotes
          }
        });
      }
      
      // Only include sentences with high relevance score and meaningful matches
      if (relevanceScore > 0.6 || matchedEntities.length >= 2) {
        allSentences.push({
          text: sentence,
          relevanceScore: Math.min(relevanceScore, 1.0),
          matchedEntities,
          page: chunk.page_number,
          lines: chunk.line_start && chunk.line_end ? `${chunk.line_start}-${chunk.line_end}` : undefined,
          section: detectSection(chunk.content)
        });
      }
    });
  });
  
  // Sort by relevance score and return only high-quality sentences
  return allSentences
    .filter(sentence => sentence.relevanceScore >= 0.6) // Strict 60% threshold
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxSentences);
}

// Enhanced semantic similarity calculation
function calculateSemanticSimilarity(sentence: string, aiResponse: string): number {
  const sentenceLower = sentence.toLowerCase();
  const aiResponseLower = aiResponse.toLowerCase();
  
  // Extract meaningful words from both texts
  const sentenceWords = extractMeaningfulWords(sentenceLower);
  const aiWords = extractMeaningfulWords(aiResponseLower);
  
  if (sentenceWords.length === 0 || aiWords.length === 0) return 0;
  
  // Calculate word overlap ratio
  const commonWords = sentenceWords.filter(word => aiWords.includes(word));
  const similarity = commonWords.length / Math.max(sentenceWords.length, aiWords.length);
  
  return similarity;
}

// Extract meaningful words (exclude common/stop words)
function extractMeaningfulWords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'document', 'documents', 'contract', 'agreement', 'case', 'legal']);
  
  return text.split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .map(word => word.replace(/[^\w]/g, ''));
}

// Detect section information from content
function detectSection(content: string): string | undefined {
  const patterns = [
    /(?:Section|SECTION)\s*(\d+(?:\.\d+)?)\s*:?\s*([^.\n]+)/i,
    /(?:Article|ARTICLE)\s*(\d+(?:\.\d+)?)\s*:?\s*([^.\n]+)/i,
    /(?:Part|PART)\s*(\w+)\s*:?\s*([^.\n]+)/i,
    /^\s*(\d+\.\s*[A-Z][^.\n]+)/m
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

// Enhanced answer similarity calculation
export function calculateAnswerSimilarity(sentence: string, aiResponse: string): number {
  const entities = extractAnswerEntities(aiResponse);
  let similarity = 0;
  
  entities.forEach(entity => {
    const entityRegex = new RegExp(entity.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (entityRegex.test(sentence)) {
      switch (entity.type) {
        case 'name': similarity += 0.5; break;
        case 'age': similarity += 0.4; break;
        case 'date': similarity += 0.4; break;
        case 'amount': similarity += 0.35; break;
        case 'reference': similarity += 0.45; break;
        case 'number': similarity += 0.25; break;
      }
    }
  });
  
  // Add semantic similarity component
  const semanticScore = calculateSemanticSimilarity(sentence, aiResponse);
  similarity += semanticScore * 0.3;
  
  return Math.min(similarity, 1.0);
}
