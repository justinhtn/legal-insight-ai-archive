
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

    const { fileName, fileType, fileSize, content, title } = await req.json()

    // Insert document record
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .insert({
        user_id: user.id,
        title: title || fileName,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        content: content
      })
      .select()
      .single()

    if (docError) throw docError

    // Split content into chunks for embedding
    const chunks = splitIntoChunks(content, 1000) // 1000 character chunks

    // Generate embeddings for each chunk
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const embeddings = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunk,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const embeddingData = await response.json()
      const embedding = embeddingData.data[0].embedding

      // Store embedding in database
      const { error: embeddingError } = await supabaseClient
        .from('document_embeddings')
        .insert({
          document_id: document.id,
          chunk_index: i,
          content: chunk,
          embedding: embedding
        })

      if (embeddingError) throw embeddingError

      embeddings.push({ chunk_index: i, content: chunk })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        document_id: document.id,
        chunks_processed: embeddings.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error processing document:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks = []
  let currentIndex = 0
  
  while (currentIndex < text.length) {
    let endIndex = currentIndex + chunkSize
    
    // Try to break at a sentence or word boundary
    if (endIndex < text.length) {
      const lastPeriod = text.lastIndexOf('.', endIndex)
      const lastSpace = text.lastIndexOf(' ', endIndex)
      
      if (lastPeriod > currentIndex + chunkSize * 0.8) {
        endIndex = lastPeriod + 1
      } else if (lastSpace > currentIndex + chunkSize * 0.8) {
        endIndex = lastSpace
      }
    }
    
    chunks.push(text.slice(currentIndex, endIndex).trim())
    currentIndex = endIndex
  }
  
  return chunks.filter(chunk => chunk.length > 0)
}
