import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// WebSocket upgrade handler for YJS collaboration
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle WebSocket upgrade
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req)
    
    // Extract document ID from URL
    const url = new URL(req.url)
    const documentId = url.searchParams.get('documentId')
    
    if (!documentId) {
      return new Response('Document ID required', { status: 400, headers: corsHeaders })
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    let userId: string | null = null
    
    socket.onopen = () => {
      console.log(`WebSocket opened for document: ${documentId}`)
    }

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Handle authentication
        if (data.type === 'auth') {
          const { data: { user } } = await supabaseClient.auth.getUser(data.token)
          userId = user?.id || null
          
          if (userId) {
            // Update collaborative session
            await supabaseClient
              .from('collaborative_sessions')
              .upsert({
                document_id: documentId,
                user_id: userId,
                last_activity: new Date().toISOString(),
                is_active: true
              })
          }
          
          socket.send(JSON.stringify({ type: 'auth_success', userId }))
          return
        }

        // Handle YJS document updates
        if (data.type === 'yjs_update') {
          // Store document changes for audit trail
          if (userId && data.update) {
            await supabaseClient
              .from('document_changes')
              .insert({
                document_id: documentId,
                user_id: userId,
                change_type: 'yjs_update',
                timestamp: new Date().toISOString(),
                metadata: { update: data.update }
              })
          }
          
          // Broadcast to other clients (this would be handled by a proper YJS WebSocket server)
          console.log(`YJS update for document ${documentId}:`, data.update)
        }

        // Handle awareness updates (cursor positions, selections)
        if (data.type === 'awareness_update') {
          if (userId) {
            await supabaseClient
              .from('collaborative_sessions')
              .update({
                cursor_position: data.cursorPosition,
                selection_start: data.selectionStart,
                selection_end: data.selectionEnd,
                last_activity: new Date().toISOString()
              })
              .eq('document_id', documentId)
              .eq('user_id', userId)
          }
        }

      } catch (error) {
        console.error('WebSocket message error:', error)
        socket.send(JSON.stringify({ type: 'error', message: error.message }))
      }
    }

    socket.onclose = async () => {
      console.log(`WebSocket closed for document: ${documentId}`)
      
      // Mark session as inactive
      if (userId) {
        await supabaseClient
          .from('collaborative_sessions')
          .update({
            is_active: false,
            session_end: new Date().toISOString()
          })
          .eq('document_id', documentId)
          .eq('user_id', userId)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return response
  }

  // Regular HTTP endpoint for collaboration status
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

    const url = new URL(req.url)
    const documentId = url.searchParams.get('documentId')

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Document ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get active collaborative sessions for the document
    const { data: sessions, error } = await supabaseClient
      .from('collaborative_sessions')
      .select(`
        *,
        user:user_id(email)
      `)
      .eq('document_id', documentId)
      .eq('is_active', true)
      .gte('last_activity', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Active in last 5 minutes

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ 
        activeSessions: sessions || [],
        collaboratorCount: sessions?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in yjs-websocket function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})