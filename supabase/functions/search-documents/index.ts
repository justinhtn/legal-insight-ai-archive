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

    // Calculate similarities and get top results
    const results = embeddings
      .map(embedding => {
        const similarity = cosineSimilarity(queryEmbedding, embedding.embedding)
        return {
          ...embedding,
          similarity
        }
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 12) // Reduce to top 12 for better performance

    console.log(`Found ${results.length} document chunks for RAG analysis`)

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
1. You MUST base your answer EXACTLY on the document content provided
2. When citing specific information, quote the EXACT text from the documents
3. Use this EXACT format when referencing documents: "Document: [filename] | Section: [section] | Lines: [range]"
4. NEVER make up information not found in the provided documents
5. If asked about specific details (names, ages, dates, amounts), quote them EXACTLY as they appear

RESPONSE REQUIREMENTS:
1. SCAN for the EXACT answer in the documents
2. Quote directly from documents when citing specific facts
3. Give the MOST DIRECT answer possible - usually 1-2 sentences
4. Do NOT add boilerplate phrases like "If you require further details..."
5. For list questions, format as bullet points
6. Be precise and factual, quote exact text when referencing specific information
7. ALWAYS base your answer on the actual document content provided
8. Stay consistent with the client context - this is a ${client_context?.match(/Case Type: ([^\n]+)/)?.[1] || 'legal'} case

EXACT CITATION EXAMPLES:
When you find information like "EMMA JOHNSON, age 7" in a document, your response should quote this EXACTLY.
When you find "The contract was signed on January 15, 2025", quote this EXACTLY.

Examples:
Q: "What were the ages of the two minors?"
A: "EMMA JOHNSON, age 7 - JACOB JOHNSON, age 5"

Q: "What is the contract amount?"
A: "$50,000 as stated in Section 3.2"

Q: "When was the agreement signed?"
A: "January 15, 2025"

Document excerpts are provided below with their titles and location information.

CRITICAL: You MUST follow this exact format for your response:

1. First, provide your main answer
2. Then add these two sections EXACTLY as shown:

RELEVANT_SPANS:
Document 1: "exact text from document 1 that answers the query"
Document 2: null
Document 3: "exact text from document 3 that answers the query"

METADATA:
Document 1: {"entities": ["TechVentures LLC"], "dates": ["January 15, 2025"], "section": "Payment Terms", "legal_concept": "compensation"}
Document 3: {"entities": ["$125,000"], "dates": [], "section": "Contract Terms", "legal_concept": "total_compensation"}

SPAN EXTRACTION RULES:
- Extract the EXACT sentence/line that directly answers the user's query
- If a document chunk doesn't contain a direct answer, write "null"
- For list items, extract just the relevant bullet point
- Include minimal surrounding context only if needed for clarity
- Prefer specific facts over general statements

METADATA EXTRACTION:
Also extract key legal metadata from chunks with relevant spans:

METADATA:
Document 1: {"entities": ["$25,000", "$50,000", "$45,000"], "dates": [], "section": "Payment Terms", "legal_concept": "compensation"}
Document 3: {"entities": ["$125,000"], "dates": [], "section": "Contract Terms", "legal_concept": "total_compensation"}
...

Extract:
- entities: People, companies, amounts mentioned
- dates: Any dates found
- section: What part of document (Facts, Terms, Procedures, etc.)
- legal_concept: Main legal topic (compensation, custody, breach, etc.)`;

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

Document Excerpts:
${documentContext}

Provide a direct, concise answer based on these documents. When citing information, use the EXACT format: Document: [filename] | Section: [section] | Lines: [range]`
          }
        ],
        temperature: 0.1,
        max_tokens: 800 // Increased for relevance scores and metadata
      }),
    })

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      console.error(`OpenAI Chat API error: ${chatResponse.status} ${chatResponse.statusText} - ${errorText}`)
      throw new Error(`OpenAI Chat API error: ${chatResponse.statusText}`)
    }

    const chatData = await chatResponse.json()
    const fullResponse = chatData.choices[0].message.content

    // Parse LLM response to extract main answer, relevant spans, and metadata
    const parts = fullResponse.split(/(?:RELEVANT_SPANS:|METADATA:)/);
    const aiResponse = parts[0].trim();
    const relevantSpansSection = parts[1];
    const metadataSection = parts[2];
    
    console.log('Parsing LLM response sections:');
    console.log('- Main response length:', aiResponse.length);
    console.log('- Has RELEVANT_SPANS section:', !!relevantSpansSection);
    console.log('- Has METADATA section:', !!metadataSection);
    console.log('- Full response preview:', fullResponse.substring(0, 500));
    
    // Parse relevant spans
    const relevantSpans = new Map<number, string | null>();
    if (relevantSpansSection) {
      console.log('Parsing RELEVANT_SPANS section:', relevantSpansSection.trim());
      const spanLines = relevantSpansSection.trim().split('\n');
      spanLines.forEach(line => {
        const match = line.match(/Document (\d+):\s*(.+)/);
        if (match) {
          const docNum = parseInt(match[1]) - 1; // Convert to 0-based index
          const span = match[2].trim();
          console.log(`Found span for Document ${docNum + 1}:`, span);
          // Handle null values
          if (span.toLowerCase() === 'null' || span === '""' || span === "''") {
            relevantSpans.set(docNum, null);
          } else {
            // Remove quotes if present
            const cleanSpan = span.replace(/^["']|["']$/g, '');
            relevantSpans.set(docNum, cleanSpan);
          }
        }
      });
    } else {
      console.log('No RELEVANT_SPANS section found - LLM may not be following format');
    }

    // Parse metadata
    const chunkMetadata = new Map<number, any>();
    if (metadataSection) {
      const metadataLines = metadataSection.trim().split('\n');
      metadataLines.forEach(line => {
        const match = line.match(/Document (\d+):\s*(\{.*\})/);
        if (match) {
          try {
            const docNum = parseInt(match[1]) - 1;
            const metadata = JSON.parse(match[2]);
            chunkMetadata.set(docNum, metadata);
          } catch (e) {
            console.warn('Failed to parse metadata for line:', line);
          }
        }
      });
    }

    console.log('Parsed relevant spans:', Object.fromEntries(relevantSpans));
    console.log('Parsed metadata:', Object.fromEntries(chunkMetadata));
    console.log('Full LLM response:', fullResponse);

    // If no spans were extracted, use a fallback approach
    if (relevantSpans.size === 0) {
      console.log('No spans extracted, trying fallback extraction from main response');
      
      // Try to extract quoted content from the main response as spans
      const quotedContent = aiResponse.match(/\*\*([^*]+)\*\*/g);
      if (quotedContent) {
        quotedContent.forEach((quote, index) => {
          if (index < results.length) {
            const cleanQuote = quote.replace(/\*\*/g, '').trim();
            relevantSpans.set(index, cleanQuote);
            console.log(`Fallback span ${index + 1}:`, cleanQuote);
          }
        });
      }
    }

    // Return enhanced response with detailed source documents and extracted spans
    const sourceDocuments = results
      .map((result, index) => ({
        ...result,
        relevant_span: relevantSpans.get(index) || null,
        legal_metadata: chunkMetadata.get(index) || {}
      }))
      .filter(result => result.similarity > 0.2) // Remove the span requirement for now
      .sort((a, b) => b.similarity - a.similarity) // Sort by similarity since we're filtering by span relevance
      .slice(0, 6) // Top 6 sources
      .map(result => {
        const metadata = result.metadata || {};
        return {
          document_id: result.documents.id,
          document_title: result.documents.title,
          document_file_name: result.documents.file_name,
          content: result.content,
          similarity: result.similarity,
          relevant_span: result.relevant_span,
          legal_metadata: result.legal_metadata,
          chunk_index: result.chunk_index,
          page_number: result.page_number,
          line_start: result.line_start,
          line_end: result.line_end,
          client: metadata.client,
          matter: metadata.matter
        };
      });

    const contextMessage = client_id 
      ? `AI analysis based on ${sourceDocuments.length} relevant document sections from selected client`
      : `AI analysis based on ${sourceDocuments.length} relevant document sections across all clients`

    console.log(`Generated RAG response with ${sourceDocuments.length} source documents`)

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
