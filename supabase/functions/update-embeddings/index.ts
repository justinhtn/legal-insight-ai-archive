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

    const { documentId } = await req.json()
    
    if (!documentId) {
      throw new Error('Document ID is required')
    }

    console.log('Updating embeddings for document:', documentId)

    // Fetch the document content
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('id, content, file_name, title')
      .eq('id', documentId)
      .single()

    if (docError) {
      console.error('Error fetching document:', docError)
      throw new Error(`Failed to fetch document: ${docError.message}`)
    }

    if (!document || !document.content) {
      console.log('No content found for document:', documentId)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No content to process for embeddings'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Delete existing embeddings for this document
    const { error: deleteError } = await supabaseClient
      .from('document_embeddings')
      .delete()
      .eq('document_id', documentId)

    if (deleteError) {
      console.error('Error deleting old embeddings:', deleteError)
      // Continue anyway - we'll overwrite them
    }

    // Create simple chunks from content
    const chunks = createSimpleChunks(document.content, document.file_name || document.title)
    console.log(`Split content into ${chunks.length} chunks`)

    // Generate embeddings for each chunk
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment variables')
      throw new Error('OpenAI API key not configured')
    }

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
            input: chunk.text,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`OpenAI API error for chunk ${i}: ${response.status} ${response.statusText} - ${errorText}`)
          
          // If it's a rate limit error, wait and retry once
          if (response.status === 429) {
            console.log('Rate limit hit, waiting 5 seconds before retry...')
            await new Promise(resolve => setTimeout(resolve, 5000))
            
            const retryResponse = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: chunk.text,
              }),
            })
            
            if (!retryResponse.ok) {
              console.error(`Retry failed for chunk ${i}: ${retryResponse.status} ${retryResponse.statusText}`)
              continue
            }
            
            const retryEmbeddingData = await retryResponse.json()
            const embedding = retryEmbeddingData.data[0].embedding

            const { error: embeddingError } = await supabaseClient
              .from('document_embeddings')
              .insert({
                document_id: documentId,
                chunk_index: i,
                content: chunk.text,
                embedding: embedding,
                metadata: chunk.metadata || {}
              })

            if (embeddingError) {
              console.error('Error storing embedding for chunk', i, ':', embeddingError)
            } else {
              successfulEmbeddings++
              console.log(`Successfully stored embedding for chunk ${i + 1}`)
            }
          }
          continue
        }

        const embeddingData = await response.json()
        const embedding = embeddingData.data[0].embedding

        const { error: embeddingError } = await supabaseClient
          .from('document_embeddings')
          .insert({
            document_id: documentId,
            chunk_index: i,
            content: chunk.text,
            embedding: embedding,
            metadata: chunk.metadata || {}
          })

        if (embeddingError) {
          console.error('Error storing embedding for chunk', i, ':', embeddingError)
        } else {
          successfulEmbeddings++
          console.log(`Successfully stored embedding for chunk ${i + 1}`)
        }

        // Small delay between requests to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }

      } catch (chunkError) {
        console.error(`Error processing chunk ${i}:`, chunkError)
      }
    }

    console.log(`Embedding update complete. ${successfulEmbeddings}/${chunks.length} embeddings created successfully.`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        embeddings_created: successfulEmbeddings,
        total_chunks: chunks.length,
        message: 'Embeddings updated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error updating embeddings:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

function createSimpleChunks(text: string, fileName: string) {
  const chunks: any[] = [];
  const chunkSize = 1000;
  const overlap = 200;
  let chunkIndex = 0;
  let startIndex = 0;
  
  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length);
    
    if (endIndex < text.length) {
      const lastPeriod = text.lastIndexOf('.', endIndex);
      const lastSpace = text.lastIndexOf(' ', endIndex);
      
      if (lastPeriod > startIndex + chunkSize * 0.8) {
        endIndex = lastPeriod + 1;
      } else if (lastSpace > startIndex + chunkSize * 0.8) {
        endIndex = lastSpace;
      }
    }
    
    const chunkText = text.slice(startIndex, endIndex).trim();
    
    if (chunkText.length > 50) {
      chunks.push({
        text: chunkText,
        index: chunkIndex++,
        metadata: {
          documentName: fileName
        }
      });
    }
    
    const nextStart = Math.max(startIndex + chunkSize - overlap, endIndex);
    if (nextStart <= startIndex) break;
    startIndex = nextStart;
  }
  
  return chunks;
}