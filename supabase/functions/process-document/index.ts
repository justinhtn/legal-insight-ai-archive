
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

    const { fileName, fileType, fileSize, content, title, extractedData } = await req.json()

    console.log('Processing document:', { fileName, fileType, fileSize, contentLength: content?.length, hasExtractedData: !!extractedData })

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

    // Process embeddings if we have content
    if (content && content.trim().length > 0) {
      console.log('Starting embedding generation for content...')
      
      // Use extracted data if available (for PDFs), otherwise create simple chunks
      let chunks: Array<{
        text: string;
        pageNumber?: number;
        lineStart?: number;
        lineEnd?: number;
        index: number;
        metadata: any;
      }> = [];

      if (extractedData && extractedData.pages) {
        // Process PDF with page/line tracking
        console.log(`Processing PDF with ${extractedData.pages.length} pages`)
        chunks = createChunksFromExtractedData(extractedData, fileName);
      } else {
        // Fallback for non-PDF files
        chunks = createSimpleChunks(content, fileName);
      }

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
        console.log(`Processing chunk ${i + 1}/${chunks.length} (page ${chunk.pageNumber || 'N/A'})`)
        
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
                continue // Skip this chunk but don't fail the entire process
              }
              
              const retryEmbeddingData = await retryResponse.json()
              const embedding = retryEmbeddingData.data[0].embedding

              // Store embedding with metadata
              const { error: embeddingError } = await supabaseClient
                .from('document_embeddings')
                .insert({
                  document_id: document.id,
                  chunk_index: i,
                  content: chunk.text,
                  embedding: embedding,
                  page_number: chunk.pageNumber || null,
                  line_start: chunk.lineStart || null,
                  line_end: chunk.lineEnd || null,
                  metadata: chunk.metadata || {}
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

          // Store embedding with enhanced metadata
          const { error: embeddingError } = await supabaseClient
            .from('document_embeddings')
            .insert({
              document_id: document.id,
              chunk_index: i,
              content: chunk.text,
              embedding: embedding,
              page_number: chunk.pageNumber || null,
              line_start: chunk.lineStart || null,
              line_end: chunk.lineEnd || null,
              metadata: chunk.metadata || {}
            })

          if (embeddingError) {
            console.error('Error storing embedding for chunk', i, ':', embeddingError)
          } else {
            successfulEmbeddings++
            console.log(`Successfully stored embedding for chunk ${i + 1} (page ${chunk.pageNumber || 'N/A'})`)
          }

          // Small delay between requests to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200))
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

function createChunksFromExtractedData(extractedData: any, fileName: string) {
  const chunks: any[] = [];
  let chunkIndex = 0;
  const chunkSize = 1000;
  const overlap = 200;

  for (const page of extractedData.pages) {
    const pageText = page.fullText;
    let startIndex = 0;
    
    while (startIndex < pageText.length) {
      let endIndex = Math.min(startIndex + chunkSize, pageText.length);
      
      // Try to break at sentence boundaries
      if (endIndex < pageText.length) {
        const lastPeriod = pageText.lastIndexOf('.', endIndex);
        const lastSpace = pageText.lastIndexOf(' ', endIndex);
        
        if (lastPeriod > startIndex + chunkSize * 0.8) {
          endIndex = lastPeriod + 1;
        } else if (lastSpace > startIndex + chunkSize * 0.8) {
          endIndex = lastSpace;
        }
      }
      
      const chunkText = pageText.slice(startIndex, endIndex).trim();
      
      if (chunkText.length > 50) {
        // Calculate line numbers
        const beforeChunk = pageText.slice(0, startIndex);
        const chunkLines = chunkText.split('\n').length;
        const lineStart = beforeChunk.split('\n').length;
        const lineEnd = lineStart + chunkLines - 1;
        
        chunks.push({
          text: chunkText,
          pageNumber: page.pageNum,
          lineStart,
          lineEnd,
          index: chunkIndex++,
          metadata: {
            documentName: fileName,
            client: extractClientFromFilename(fileName),
            matter: extractMatterFromFilename(fileName),
            totalPages: extractedData.totalPages
          }
        });
      }
      
      const nextStart = Math.max(startIndex + chunkSize - overlap, endIndex);
      if (nextStart <= startIndex) break;
      startIndex = nextStart;
    }
  }
  
  return chunks;
}

function createSimpleChunks(text: string, fileName: string) {
  const chunks: any[] = [];
  const chunkSize = 1000;
  const overlap = 200;
  let chunkIndex = 0;
  let startIndex = 0;
  
  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length);
    
    // Try to break at sentence boundaries
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
        pageNumber: null,
        lineStart: null,
        lineEnd: null,
        index: chunkIndex++,
        metadata: {
          documentName: fileName,
          client: extractClientFromFilename(fileName),
          matter: extractMatterFromFilename(fileName)
        }
      });
    }
    
    const nextStart = Math.max(startIndex + chunkSize - overlap, endIndex);
    if (nextStart <= startIndex) break;
    startIndex = nextStart;
  }
  
  return chunks;
}

function extractClientFromFilename(filename: string): string | undefined {
  const patterns = [
    /^([^_]+)_/,
    /^([^-]+)-/,
    /^([^\.]+)\./
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return match[1].replace(/[_-]/g, ' ').trim();
    }
  }
  
  return undefined;
}

function extractMatterFromFilename(filename: string): string | undefined {
  const matterTypes = ['divorce', 'custody', 'settlement', 'contract', 'agreement'];
  const lowerFilename = filename.toLowerCase();
  
  for (const matterType of matterTypes) {
    if (lowerFilename.includes(matterType)) {
      return matterType;
    }
  }
  
  return undefined;
}
