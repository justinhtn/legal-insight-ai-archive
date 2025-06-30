
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

// Extract specific entities and facts from AI response
export function extractAnswerEntities(aiResponse: string): AnswerEntity[] {
  const entities: AnswerEntity[] = [];
  
  // Extract names (capitalized words, often with middle initials)
  const nameMatches = aiResponse.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\s+[A-Z][A-Z]+(?:\s*,?\s*(?:age|aged)?\s*\d+)?/gi);
  if (nameMatches) {
    nameMatches.forEach(match => {
      entities.push({
        type: 'name',
        value: match.replace(/\s*,?\s*(?:age|aged)?\s*\d+/gi, '').trim(),
        context: match
      });
    });
  }
  
  // Extract ages specifically
  const ageMatches = aiResponse.match(/(?:age|aged)\s*:?\s*(\d+)|(\d+)\s*(?:years?\s*old)/gi);
  if (ageMatches) {
    ageMatches.forEach(match => {
      const ageNumber = match.match(/\d+/)?.[0];
      if (ageNumber) {
        entities.push({
          type: 'age',
          value: ageNumber,
          context: match
        });
      }
    });
  }
  
  // Extract dates
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
  
  // Extract amounts/numbers
  const amountMatches = aiResponse.match(/\$[\d,]+(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d+)?\b/g);
  if (amountMatches) {
    amountMatches.forEach(match => {
      entities.push({
        type: match.startsWith('$') ? 'amount' : 'number',
        value: match,
        context: match
      });
    });
  }
  
  // Extract case numbers, client numbers, etc.
  const referenceMatches = aiResponse.match(/(?:case|client|matter|file)\s*(?:number|#|no\.?)\s*:?\s*([A-Z0-9-]+)/gi);
  if (referenceMatches) {
    referenceMatches.forEach(match => {
      const refValue = match.match(/([A-Z0-9-]+)$/i)?.[1];
      if (refValue) {
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

// Find document sentences that contain the AI's cited information
export function findRelevantSentences(
  chunks: SearchResult[],
  aiResponse: string,
  maxSentences: number = 3
): AnswerRelevantSentence[] {
  const entities = extractAnswerEntities(aiResponse);
  console.log('Extracted entities from AI response:', entities);
  
  const allSentences: AnswerRelevantSentence[] = [];
  
  chunks.forEach(chunk => {
    // Split content into sentences
    const sentences = chunk.content
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 20)
      .map(s => s.trim());
    
    sentences.forEach(sentence => {
      const matchedEntities: AnswerEntity[] = [];
      let relevanceScore = 0;
      
      // Check each entity against the sentence
      entities.forEach(entity => {
        const entityRegex = new RegExp(entity.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (entityRegex.test(sentence)) {
          matchedEntities.push(entity);
          // Higher score for more specific entity types
          switch (entity.type) {
            case 'name': relevanceScore += 0.4; break;
            case 'age': relevanceScore += 0.3; break;
            case 'date': relevanceScore += 0.3; break;
            case 'amount': relevanceScore += 0.25; break;
            case 'reference': relevanceScore += 0.35; break;
            case 'number': relevanceScore += 0.2; break;
          }
        }
      });
      
      // Also check for semantic similarity with AI response
      const aiResponseLower = aiResponse.toLowerCase();
      const sentenceLower = sentence.toLowerCase();
      
      // Boost score if sentence contains key phrases from AI response
      const aiPhrases = aiResponseLower.match(/"([^"]+)"/g);
      if (aiPhrases) {
        aiPhrases.forEach(phrase => {
          const cleanPhrase = phrase.replace(/"/g, '');
          if (sentenceLower.includes(cleanPhrase)) {
            relevanceScore += 0.3;
          }
        });
      }
      
      // Check for word overlap
      const aiWords = aiResponseLower.split(/\s+/).filter(w => w.length > 3);
      const sentenceWords = sentenceLower.split(/\s+/);
      const overlap = aiWords.filter(word => sentenceWords.includes(word)).length;
      relevanceScore += (overlap / aiWords.length) * 0.2;
      
      if (relevanceScore > 0.1 || matchedEntities.length > 0) {
        allSentences.push({
          text: sentence,
          relevanceScore,
          matchedEntities,
          page: chunk.page_number,
          lines: chunk.line_start && chunk.line_end ? `${chunk.line_start}-${chunk.line_end}` : undefined,
          section: detectSection(chunk.content)
        });
      }
    });
  });
  
  // Sort by relevance score and return top sentences
  return allSentences
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxSentences);
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

// Calculate how well a sentence matches the AI's actual answer
export function calculateAnswerSimilarity(sentence: string, aiResponse: string): number {
  const entities = extractAnswerEntities(aiResponse);
  let similarity = 0;
  
  entities.forEach(entity => {
    const entityRegex = new RegExp(entity.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (entityRegex.test(sentence)) {
      switch (entity.type) {
        case 'name': similarity += 0.4; break;
        case 'age': similarity += 0.3; break;
        case 'date': similarity += 0.3; break;
        case 'amount': similarity += 0.25; break;
        case 'reference': similarity += 0.35; break;
        case 'number': similarity += 0.2; break;
      }
    }
  });
  
  return Math.min(similarity, 1.0);
}
