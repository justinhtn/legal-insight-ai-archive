
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { query, client_id, client_context } = await req.json()

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log('Processing search query:', query)
    if (client_id) {
      console.log('Filtering by client_id:', client_id)
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment variables')
      throw new Error('OpenAI API key not configured')
    }

    // Generate embedding for the search query
    console.log('Generating embedding for search query...')
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    })

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text()
      console.error(`OpenAI API error: ${embeddingResponse.status} ${embeddingResponse.statusText} - ${errorText}`)
      throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`)
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // Search for similar embeddings with enhanced metadata and optional client filtering
    console.log('Fetching document embeddings from database...')
    let embeddingsQuery = supabaseClient
      .from('document_embeddings')
      .select(`
        *,
        documents!inner(
          id,
          title,
          file_name,
          user_id,
          client_id
        )
      `)
      .eq('documents.user_id', user.id)

    // Add client filter if specified
    if (client_id) {
      embeddingsQuery = embeddingsQuery.eq('documents.client_id', client_id)
    }

    const { data: embeddings, error: embeddingsError } = await embeddingsQuery

    if (embeddingsError) {
      console.error('Database error:', embeddingsError)
      throw new Error(`Failed to fetch embeddings: ${embeddingsError.message}`)
    }

    if (!embeddings || embeddings.length === 0) {
      console.log('No embeddings found in database')
      const message = client_id 
        ? "I couldn't find any documents for this client. Please upload and process documents first."
        : "I couldn't find any documents to search through. Please upload and process documents first."
      
      return new Response(
        JSON.stringify({ 
          results: [],
          ai_response: message,
          message: client_id ? 'No documents found for this client' : 'No documents found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Calculate similarities with enhanced multi-factor scoring
    const results = embeddings
      .map(embedding => {
        const cosineSim = cosineSimilarity(queryEmbedding, embedding.embedding)
        const enhancedScore = calculateEnhancedRelevanceScore(embedding.content, query, cosineSim)
        
        return {
          ...embedding,
          similarity: enhancedScore.totalScore,
          relevanceFactors: enhancedScore.factors
        }
      })
      .filter(result => result.similarity >= 0.7) // Strict 70% threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8) // Reduce to top 8 for better quality

    console.log(`Found ${results.length} high-relevance document chunks for RAG analysis`)

    if (results.length === 0) {
      const lowQualityMessage = "I couldn't find documents with strong relevance to your query. Try rephrasing your question or asking about different topics covered in your documents."
      
      return new Response(
        JSON.stringify({ 
          results: [],
          ai_response: lowQualityMessage,
          message: 'No highly relevant documents found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Prepare enhanced context for OpenAI with metadata
    const documentContext = results.map((result, index) => {
      const metadata = result.metadata || {};
      const pageInfo = result.page_number ? `Page ${result.page_number}` : 'Unknown page';
      const lineInfo = result.line_start && result.line_end ? 
        `Lines ${result.line_start}-${result.line_end}` : 
        `Chunk ${result.chunk_index}`;
      
      return `Document ${index + 1}:
Title: ${result.documents.title}
File: ${result.documents.file_name}
Location: ${pageInfo} | ${lineInfo}
Relevance Score: ${(result.similarity * 100).toFixed(1)}%
Content: "${result.content}"
---`;
    }).join('\n\n');

    // Determine model based on query complexity and type
    const isSimpleQuery = query.length < 50 && (
      query.toLowerCase().includes('what is') ||
      query.toLowerCase().includes('when') ||
      query.toLowerCase().includes('who') ||
      query.toLowerCase().includes('how much') ||
      query.toLowerCase().includes('number') ||
      query.toLowerCase().includes('client number') ||
      query.toLowerCase().includes('case number')
    );

    const model = isSimpleQuery ? 'gpt-3.5-turbo' : 'gpt-4o-mini';

    // Enhanced system prompt with stricter document referencing requirements
    const systemPrompt = `You are a legal document assistant helping attorneys manage client cases. 

${client_context ? `Current Client Context:\n${client_context}\n` : ''}

CRITICAL INSTRUCTIONS FOR DOCUMENT REFERENCES:
1. You MUST base your answer EXACTLY on the high-relevance document content provided (all documents have 70%+ relevance scores)
2. When citing specific information, quote the EXACT text from the documents
3. Use this EXACT format when referencing documents: "Document: [filename] | Section: [section] | Lines: [range]"
4. NEVER make up information not found in the provided documents
5. If asked about specific details (names, ages, dates, amounts), quote them EXACTLY as they appear

RESPONSE REQUIREMENTS:
1. SCAN for the EXACT answer in the highly relevant documents
2. Quote directly from documents when citing specific facts
3. Give the MOST DIRECT answer possible - usually 1-2 sentences
4. Do NOT add boilerplate phrases like "If you require further details..."
5. For list questions, format as bullet points
6. Be precise and factual, quote exact text when referencing specific information
7. ALWAYS base your answer on the actual document content provided
8. Stay consistent with the client context - this is a ${client_context?.match(/Case Type: ([^\n]+)/)?.[1] || 'legal'} case

Only reference documents that are truly relevant to the query. These documents have been pre-filtered for high relevance.

Document excerpts are provided below with their titles, location information, and relevance scores.`;

    // Generate enhanced RAG response using OpenAI with improved system prompt
    console.log(`Generating RAG response with ${model}...`)
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Query: ${query}

High-Relevance Document Excerpts (70%+ relevance):
${documentContext}

Provide a direct, concise answer based on these highly relevant documents. When citing information, use the EXACT format: Document: [filename] | Section: [section] | Lines: [range]`
          }
        ],
        temperature: 0.1,
        max_tokens: 400
      }),
    })

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      console.error(`OpenAI Chat API error: ${chatResponse.status} ${chatResponse.statusText} - ${errorText}`)
      throw new Error(`OpenAI Chat API error: ${chatResponse.statusText}`)
    }

    const chatData = await chatResponse.json()
    const aiResponse = chatData.choices[0].message.content

    // Return enhanced response with high-quality source documents
    const sourceDocuments = results
      .filter(result => result.similarity > 0.7) // Ensure 70%+ relevance
      .slice(0, 5) // Top 5 sources
      .map(result => {
        const metadata = result.metadata || {};
        return {
          document_id: result.documents.id,
          document_title: result.documents.title,
          document_file_name: result.documents.file_name,
          content: result.content,
          similarity: result.similarity,
          chunk_index: result.chunk_index,
          page_number: result.page_number,
          line_start: result.line_start,
          line_end: result.line_end,
          client: metadata.client,
          matter: metadata.matter,
          relevance_factors: result.relevanceFactors
        };
      });

    const contextMessage = client_id 
      ? `AI analysis based on ${sourceDocuments.length} high-relevance document sections (70%+ match) from selected client`
      : `AI analysis based on ${sourceDocuments.length} high-relevance document sections (70%+ match) across all clients`

    console.log(`Generated RAG response with ${sourceDocuments.length} high-relevance source documents`)

    return new Response(
      JSON.stringify({ 
        results: sourceDocuments,
        ai_response: aiResponse,
        message: contextMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in search-documents function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

// Enhanced multi-factor relevance scoring function
function calculateEnhancedRelevanceScore(content: string, query: string, cosineSimilarity: number) {
  const contentLower = content.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Extract meaningful query terms (exclude common words)
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'document', 'documents', 'contract', 'agreement', 'case', 'legal']);
  
  const queryTerms = queryLower.split(/\s+/)
    .filter(term => term.length > 2 && !commonWords.has(term));
  
  if (queryTerms.length === 0) {
    return { totalScore: cosineSimilarity, factors: { cosine: cosineSimilarity } };
  }

  // 1. Exact phrase matching (40% weight)
  let exactPhraseScore = 0;
  const queryPhrases = extractMeaningfulPhrases(queryLower);
  queryPhrases.forEach(phrase => {
    if (contentLower.includes(phrase)) {
      exactPhraseScore += 0.8;
    }
  });
  exactPhraseScore = Math.min(exactPhraseScore, 1.0);

  // 2. Semantic similarity from embeddings (35% weight)
  const semanticScore = cosineSimilarity;

  // 3. Context relevance - concentrated vs scattered matches (20% weight)
  let contextScore = 0;
  let matchesFound = 0;
  let totalMatches = 0;
  
  queryTerms.forEach(term => {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = (contentLower.match(regex) || []).length;
    if (matches > 0) {
      matchesFound++;
      totalMatches += matches;
    }
  });
  
  if (queryTerms.length > 0) {
    const matchRatio = matchesFound / queryTerms.length;
    const concentrationBonus = totalMatches > matchesFound ? 0.2 : 0;
    contextScore = matchRatio + concentrationBonus;
  }

  // 4. Document recency (5% weight) - placeholder for now
  const recencyScore = 0.5;

  // Calculate weighted total
  const totalScore = (
    exactPhraseScore * 0.40 +
    semanticScore * 0.35 +
    contextScore * 0.20 +
    recencyScore * 0.05
  );

  // Quality filters - require minimum meaningful matches
  const hasMinimumMatches = matchesFound >= Math.min(2, Math.ceil(queryTerms.length * 0.5));
  const hasStrongSemantic = semanticScore >= 0.6;
  const hasExactPhrase = exactPhraseScore >= 0.3;

  // Apply penalty if quality thresholds aren't met
  let finalScore = totalScore;
  if (!hasMinimumMatches && !hasStrongSemantic && !hasExactPhrase) {
    finalScore *= 0.5; // Significant penalty for weak matches
  }

  return {
    totalScore: Math.min(finalScore, 1.0),
    factors: {
      exactPhrase: exactPhraseScore,
      semantic: semanticScore,
      context: contextScore,
      recency: recencyScore,
      cosine: cosineSimilarity,
      qualityFilters: {
        hasMinimumMatches,
        hasStrongSemantic,
        hasExactPhrase
      }
    }
  };
}

// Extract meaningful phrases from query
function extractMeaningfulPhrases(query: string): string[] {
  const phrases = [];
  
  // Split by common delimiters and extract phrases of 2+ words
  const segments = query.split(/[,;.!?]/).map(s => s.trim()).filter(s => s.length > 0);
  
  segments.forEach(segment => {
    const words = segment.split(/\s+/).filter(w => w.length > 2);
    
    // Extract 2-3 word phrases
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(words.slice(i, i + 2).join(' '));
      if (i < words.length - 2) {
        phrases.push(words.slice(i, i + 3).join(' '));
      }
    }
    
    // Add full segment if it's meaningful
    if (words.length >= 2 && words.length <= 5) {
      phrases.push(segment);
    }
  });
  
  return [...new Set(phrases)]; // Remove duplicates
}

// Helper function to calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
