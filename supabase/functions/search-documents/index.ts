
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

    const { query } = await req.json()

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

    // Search for similar embeddings
    console.log('Fetching document embeddings from database...')
    const { data: embeddings, error: embeddingsError } = await supabaseClient
      .from('document_embeddings')
      .select(`
        *,
        documents!inner(
          id,
          title,
          file_name,
          user_id
        )
      `)
      .eq('documents.user_id', user.id)

    if (embeddingsError) {
      console.error('Database error:', embeddingsError)
      throw new Error(`Failed to fetch embeddings: ${embeddingsError.message}`)
    }

    if (!embeddings || embeddings.length === 0) {
      console.log('No embeddings found in database')
      return new Response(
        JSON.stringify({ 
          results: [],
          ai_response: "I couldn't find any documents to search through. Please upload and process documents first.",
          message: 'No documents found'
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
      .slice(0, 20) // Get top 20 for RAG context

    console.log(`Found ${results.length} document chunks for RAG analysis`)

    // Prepare context for OpenAI
    const documentContext = results.map((result, index) => {
      return `Document ${index + 1}:
Title: ${result.documents.title}
File: ${result.documents.file_name}
Chunk: ${result.chunk_index}
Similarity: ${Math.round(result.similarity * 100)}%
Content: ${result.content}
---`
    }).join('\n\n')

    // Generate RAG response using OpenAI
    console.log('Generating RAG response with OpenAI...')
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a senior attorney's AI assistant. Using the provided document excerpts, provide a comprehensive answer to the user's query.

IMPORTANT INSTRUCTIONS:
- Synthesize information naturally across documents, don't just list facts
- Use professional legal language appropriate for an attorney
- When citing information, reference the specific document title and chunk
- If documents contain conflicting information, note this
- Be specific about which documents contain which information
- Structure your response clearly with main points and supporting details
- If no relevant information is found, say so clearly

Document excerpts are provided below with their titles, filenames, and similarity scores.`
          },
          {
            role: 'user',
            content: `Query: ${query}

Document Excerpts:
${documentContext}

Please provide a comprehensive answer based on these documents.`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      }),
    })

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      console.error(`OpenAI Chat API error: ${chatResponse.status} ${chatResponse.statusText} - ${errorText}`)
      throw new Error(`OpenAI Chat API error: ${chatResponse.statusText}`)
    }

    const chatData = await chatResponse.json()
    const aiResponse = chatData.choices[0].message.content

    // Return both AI response and source documents
    const sourceDocuments = results
      .filter(result => result.similarity > 0.2) // Only include reasonably relevant sources
      .slice(0, 10) // Limit to top 10 sources
      .map(result => ({
        document_id: result.documents.id,
        document_title: result.documents.title,
        document_file_name: result.documents.file_name,
        content: result.content,
        similarity: result.similarity,
        chunk_index: result.chunk_index
      }))

    console.log(`Generated RAG response with ${sourceDocuments.length} source documents`)

    return new Response(
      JSON.stringify({ 
        results: sourceDocuments,
        ai_response: aiResponse,
        message: `AI analysis based on ${sourceDocuments.length} relevant document sections`
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
