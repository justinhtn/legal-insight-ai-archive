
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

    console.log('Processing document:', { fileName, fileType, fileSize, contentLength: content?.length })

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

    if (docError) {
      console.error('Error inserting document:', docError)
      throw docError
    }

    console.log('Document inserted with ID:', document.id)

    // Only process embeddings if we have actual text content
    if (content && content.trim().length > 0) {
      // Check for placeholder content and skip if found
      const isPlaceholderContent = content.includes('requires server-side processing') || 
                                   content.includes('requires specialized processing')
      
      if (isPlaceholderContent) {
        console.log('Skipping embedding generation for placeholder content')
        return new Response(
          JSON.stringify({ 
            success: true, 
            document_id: document.id,
            message: 'Document uploaded successfully (embeddings skipped for placeholder content)'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }

      // Split content into chunks for embedding
      const chunks = splitIntoChunks(content, 1000)
      console.log(`Split content into ${chunks.length} chunks`)

      // Generate embeddings for each chunk
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
      if (!openaiApiKey) {
        console.error('OpenAI API key not found in environment variables')
        throw new Error('OpenAI API key not configured')
      }

      console.log('Starting embedding generation...')
      let successfulEmbeddings = 0

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        console.log(`Processing chunk ${i + 1}/${chunks.length}`)
        
        try {
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
            const errorText = await response.text()
            console.error(`OpenAI API error for chunk ${i}: ${response.status} ${response.statusText} - ${errorText}`)
            
            // If it's a rate limit error, wait and retry once
            if (response.status === 429) {
              console.log('Rate limit hit, waiting 2 seconds before retry...')
              await new Promise(resolve => setTimeout(resolve, 2000))
              
              const retryResponse = await fetch('https://api.openai.com/v1/embeddings', {
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
              
              if (!retryResponse.ok) {
                console.error(`Retry failed for chunk ${i}: ${retryResponse.status} ${retryResponse.statusText}`)
                continue // Skip this chunk but don't fail the entire process
              }
              
              const retryEmbeddingData = await retryResponse.json()
              const embedding = retryEmbeddingData.data[0].embedding

              // Store embedding in database
              const { error: embeddingError } = await supabaseClient
                .from('document_embeddings')
                .insert({
                  document_id: document.id,
                  chunk_index: i,
                  content: chunk,
                  embedding: embedding
                })

              if (embeddingError) {
                console.error('Error storing embedding for chunk', i, ':', embeddingError)
              } else {
                successfulEmbeddings++
                console.log(`Successfully stored embedding for chunk ${i + 1}`)
              }
            }
            continue // Skip this chunk but don't fail the entire process
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

          if (embeddingError) {
            console.error('Error storing embedding for chunk', i, ':', embeddingError)
          } else {
            successfulEmbeddings++
            console.log(`Successfully stored embedding for chunk ${i + 1}`)
          }

          // Small delay between requests to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }

        } catch (chunkError) {
          console.error(`Error processing chunk ${i}:`, chunkError)
          // Continue with other chunks
        }
      }

      console.log(`Embedding generation complete. ${successfulEmbeddings}/${chunks.length} embeddings created successfully.`)

      if (successfulEmbeddings === 0) {
        console.warn('No embeddings were created successfully')
      }
    } else {
      console.log('No content to process for embeddings')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        document_id: document.id,
        message: 'Document processed successfully'
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
