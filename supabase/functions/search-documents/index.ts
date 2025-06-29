
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

    // Generate embedding for the search query
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment variables')
      throw new Error('OpenAI API key not configured')
    }

    console.log('OpenAI API key found, generating embedding for search query...')
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
    console.log('Generated embedding for search query successfully')

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

    console.log(`Found ${embeddings?.length || 0} embeddings to search through`)

    if (!embeddings || embeddings.length === 0) {
      console.log('No embeddings found in database')
      return new Response(
        JSON.stringify({ 
          results: [],
          message: 'No documents with embeddings found. Please upload and process documents first.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Calculate cosine similarity for each embedding
    const results = embeddings
      .map(embedding => {
        const similarity = cosineSimilarity(queryEmbedding, embedding.embedding)
        return {
          ...embedding,
          similarity
        }
      })
      .filter(result => result.similarity > 0.7) // Filter for relevant results
      .sort((a, b) => b.similarity - a.similarity) // Sort by similarity desc
      .slice(0, 10) // Limit to top 10 results

    console.log(`Returning ${results.length} search results`)

    return new Response(
      JSON.stringify({ 
        results: results.map(result => ({
          document_id: result.documents.id,
          document_title: result.documents.title,
          document_file_name: result.documents.file_name,
          content: result.content,
          similarity: result.similarity,
          chunk_index: result.chunk_index
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error searching documents:', error)
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
