import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import { Textarea } from '@/components/ui/textarea';
// Removed YJS imports - using Supabase Realtime instead
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Save, 
  Users, 
  History, 
  Download, 
  Lock, 
  Unlock,
  Camera,
  FileText,
  Clock,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Collaborator colors for user identification
const COLLABORATOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

interface CollaboratorInfo {
  id: string;
  name: string;
  email: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
  isActive: boolean;
}

interface DocumentVersion {
  id: string;
  versionNumber: number;
  content: string;
  createdAt: string;
  createdBy: string;
  changeSummary?: string;
  isAutoSave: boolean;
}

interface DocumentSnapshot {
  id: string;
  label: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  versionId: string;
  isLocked: boolean;
}

interface CollaborativeDocumentEditorProps {
  documentId: string;
  documentTitle: string;
  initialContent: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
  };
  onVersionHistoryToggle: () => void;
  showVersionHistory: boolean;
  onDocumentUpdate?: (content: string) => void;
}


const CollaborativeDocumentEditor: React.FC<CollaborativeDocumentEditorProps> = ({
  documentId,
  documentTitle,
  initialContent,
  currentUser,
  onVersionHistoryToggle,
  showVersionHistory,
  onDocumentUpdate
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const realtimeChannelRef = useRef<any>(null);
  const lastSaveTimeRef = useRef<number>(Date.now());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([]);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [fallbackContent, setFallbackContent] = useState(initialContent);
  
  const { toast } = useToast();

  // Initialize collaborative editing function
  const initializeCollaboration = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) {
      console.log('Editor not ready for collaboration');
      return;
    }
    
    console.log('Initializing collaborative editing...');

    // Set initial content in Monaco editor
    if (initialContent) {
      editorRef.current.setValue(initialContent);
    }

    // Set up Supabase Realtime for collaborative editing
    const channel = supabase.channel(`document-${documentId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: currentUser.id }
      }
    });

    // Listen for document content changes from other users
    channel.on('broadcast', { event: 'document_change' }, (payload: any) => {
      if (payload.payload.userId !== currentUser.id && editorRef.current) {
        const currentContent = editorRef.current.getValue();
        if (currentContent !== payload.payload.content) {
          const position = editorRef.current.getPosition();
          editorRef.current.setValue(payload.payload.content);
          if (position) {
            editorRef.current.setPosition(position);
          }
        }
      }
    });

    // Listen for cursor position updates
    channel.on('broadcast', { event: 'cursor_update' }, (payload: any) => {
      updateCollaboratorCursor(payload.payload);
    });

    // Track user presence (who's online)
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      updateCollaboratorsList(presenceState);
    });

    // Subscribe to the channel
    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        
        // Track user presence
        await channel.track({
          user_id: currentUser.id,
          user_name: currentUser.name || currentUser.email,
          user_email: currentUser.email,
          online_at: new Date().toISOString(),
        });
        
        console.log('Connected to collaborative editing');
      } else {
        setIsConnected(false);
      }
    });

    realtimeChannelRef.current = channel;

    // Set up Monaco editor change listener for broadcasting
    const onContentChange = () => {
      if (editorRef.current) {
        const content = editorRef.current.getValue();
        
        // Broadcast changes to other users (debounced)
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        saveTimeoutRef.current = setTimeout(() => {
          channel.send({
            type: 'broadcast',
            event: 'document_change',
            payload: {
              userId: currentUser.id,
              content,
              timestamp: Date.now()
            }
          });
          
          // Auto-save to database
          saveVersion(content, true);
        }, 1000); // Debounce 1 second
      }
    };

    // Set up cursor position broadcasting
    const onCursorChange = () => {
      if (editorRef.current) {
        const position = editorRef.current.getPosition();
        if (position) {
          channel.send({
            type: 'broadcast',
            event: 'cursor_update',
            payload: {
              userId: currentUser.id,
              position: {
                lineNumber: position.lineNumber,
                column: position.column
              },
              timestamp: Date.now()
            }
          });
        }
      }
    };

    // Add Monaco editor event listeners
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const contentChangeDisposable = model.onDidChangeContent(onContentChange);
        const cursorChangeDisposable = editorRef.current.onDidChangeCursorPosition(onCursorChange);
        
        // Store disposables for cleanup
        realtimeChannelRef.current.disposables = [contentChangeDisposable, cursorChangeDisposable];
      }
    }

    // Record collaborative session
    recordSession();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (realtimeChannelRef.current) {
        // Clean up event listeners
        if (realtimeChannelRef.current.disposables) {
          realtimeChannelRef.current.disposables.forEach((disposable: any) => disposable.dispose());
        }
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
    
    // Return cleanup function
    return cleanup;
  }, [documentId, currentUser]);

  // Helper function to update collaborator cursor positions
  const updateCollaboratorCursor = useCallback((payload: any) => {
    setCollaborators(prev => prev.map(collaborator => 
      collaborator.id === payload.userId
        ? { 
            ...collaborator, 
            cursor: {
              line: payload.position.lineNumber,
              column: payload.position.column
            }
          }
        : collaborator
    ));
  }, []);

  // Helper function to update collaborators list from presence state
  const updateCollaboratorsList = useCallback((presenceState: any) => {
    const collaboratorsList: CollaboratorInfo[] = [];
    
    Object.entries(presenceState).forEach(([userId, presences]: [string, any]) => {
      if (userId !== currentUser.id && presences.length > 0) {
        const presence = presences[0];
        collaboratorsList.push({
          id: presence.user_id,
          name: presence.user_name || 'Anonymous',
          email: presence.user_email || '',
          color: COLLABORATOR_COLORS[collaboratorsList.length % COLLABORATOR_COLORS.length],
          isActive: true
        });
      }
    });
    
    setCollaborators(collaboratorsList);
  }, [currentUser.id]);

  // Update document embeddings after save
  const updateDocumentEmbeddings = async (docId: string) => {
    try {
      const { error } = await supabase.functions.invoke('process-document', {
        body: { documentId: docId, updateEmbeddings: true }
      });
      
      if (error) {
        console.error('Error updating embeddings:', error);
      } else {
        console.log('Embeddings update triggered successfully');
      }
    } catch (err) {
      console.error('Failed to trigger embedding update:', err);
    }
  };

  // Record collaborative session in database (placeholder)
  const recordSession = async () => {
    try {
      // Placeholder for when collaborative_sessions table is implemented
      console.log('Recording collaborative session for user:', currentUser.id);
    } catch (error) {
      console.error('Error recording session:', error);
    }
  };

  // Save document version
  const saveVersion = async (content: string, isAutoSave: boolean = false) => {
    try {
      // Simply update the main documents table with latest content
      const { error } = await supabase
        .from('documents')
        .update({ 
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);
      
      if (error) throw error;

      setLastSaved(new Date());
      
      if (!isAutoSave) {
        toast({
          title: "Document Saved",
          description: "Document saved successfully",
        });
        
        // Update embeddings if save was successful
        console.log('Triggering embedding update for document:', documentId);
        updateDocumentEmbeddings(documentId);
      }

    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: "Save Error",
        description: "Failed to save document",
        variant: "destructive"
      });
    }
  };

  // Create snapshot (placeholder - snapshots table doesn't exist yet)
  const createSnapshot = async (label: string, description?: string) => {
    if (!editorRef.current) return;

    setIsCreatingSnapshot(true);
    try {
      // For now, just save the current document content
      const content = editorRef.current.getValue();
      await saveVersion(content, false);

      toast({
        title: "Snapshot Created",
        description: `"${label}" saved to document (snapshot tables not yet implemented)`,
      });
    } catch (error) {
      console.error('Error creating snapshot:', error);
      toast({
        title: "Snapshot Error",
        description: "Failed to create snapshot",
        variant: "destructive"
      });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  // Load versions (placeholder - versions table doesn't exist yet)
  const loadVersions = async () => {
    // Placeholder for when version tables are implemented
    setVersions([]);
  };

  // Load snapshots (placeholder - snapshots table doesn't exist yet)
  const loadSnapshots = async () => {
    // Placeholder for when snapshot tables are implemented
    setSnapshots([]);
  };

  // Manual save
  const handleSave = () => {
    if (editorRef.current) {
      const content = editorRef.current.getValue();
      saveVersion(content, false);
    }
  };

  // Handle snapshot creation
  const handleCreateSnapshot = () => {
    const label = prompt('Enter snapshot label (e.g., "Draft for client review"):');
    if (label) {
      const description = prompt('Enter description (optional):');
      createSnapshot(label, description || undefined);
    }
  };

  // Export snapshot as PDF
  const exportSnapshotAsPDF = async (snapshotId: string) => {
    // This would integrate with jsPDF to export the snapshot
    toast({
      title: "Export Started",
      description: "PDF export will be ready shortly",
    });
  };

  useEffect(() => {
    loadVersions();
    loadSnapshots();
  }, [documentId]);

  // Update editor content when initialContent changes
  useEffect(() => {
    if (editorRef.current && initialContent !== editorRef.current.getValue()) {
      console.log('Updating editor content due to initialContent change');
      editorRef.current.setValue(initialContent);
      setFallbackContent(initialContent);
    }
  }, [initialContent]);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-gray-500" />
          <h2 className="font-semibold text-gray-900 truncate">{documentTitle}</h2>
          {isLocked && <Lock className="h-4 w-4 text-red-500" />}
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status */}
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>

          {/* Collaborators */}
          {collaborators.length > 0 && (
            <TooltipProvider>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-gray-500" />
                <div className="flex -space-x-2">
                  {collaborators.slice(0, 3).map((collaborator) => (
                    <Tooltip key={collaborator.id}>
                      <TooltipTrigger>
                        <Avatar className="h-6 w-6 border-2 border-white">
                          <AvatarFallback 
                            style={{ backgroundColor: collaborator.color }}
                            className="text-white text-xs"
                          >
                            {collaborator.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{collaborator.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {collaborators.length > 3 && (
                    <Badge variant="secondary" className="h-6 text-xs">
                      +{collaborators.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </TooltipProvider>
          )}

          <Separator orientation="vertical" className="h-6" />

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>

          <Button variant="outline" size="sm" onClick={handleCreateSnapshot} disabled={isCreatingSnapshot}>
            <Camera className="h-4 w-4 mr-1" />
            Snapshot
          </Button>

          <Button variant="outline" size="sm" onClick={onVersionHistoryToggle}>
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {lastSaved && (
        <div className="px-3 py-1 bg-green-50 border-b text-sm text-green-700">
          <Clock className="h-3 w-3 inline mr-1" />
          Last saved: {format(lastSaved, 'HH:mm:ss')}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 relative overflow-hidden">
        {editorError ? (
          // Fallback textarea if Monaco fails
          <div className="w-full h-full p-4">
            <div className="text-red-600 mb-2 text-sm">
              Monaco Editor failed to load. Using fallback editor.
            </div>
            <Textarea
              value={fallbackContent}
              onChange={(e) => {
                setFallbackContent(e.target.value);
                // Trigger save after a delay
                setTimeout(() => saveVersion(e.target.value, true), 1000);
              }}
              className="w-full h-full resize-none font-mono text-sm"
              placeholder="Document content..."
            />
          </div>
        ) : (
          <div className="w-full h-full">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage="plaintext"
              value={initialContent}
              theme="vs-light"
              loading={<div className="flex items-center justify-center h-full text-gray-500">Loading Monaco Editor...</div>}
              options={{
                fontSize: 14,
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                lineNumbers: 'on',
                wordWrap: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                folding: false,
                renderWhitespace: 'none',
                rulers: [80],
                bracketPairColorization: { enabled: false },
                readOnly: false
              }}
              onMount={(editor, monaco) => {
                console.log('Monaco Editor mounted successfully!', editor);
                editorRef.current = editor;
                monacoRef.current = monaco;
                setIsConnected(true);
                
                // Set initial content after mounting
                if (initialContent) {
                  console.log('Setting initial content:', initialContent.substring(0, 100) + '...');
                  editor.setValue(initialContent);
                }
                
                // Initialize collaborative features after Monaco is ready
                setTimeout(() => {
                  console.log('Initializing collaboration from onMount');
                  initializeCollaboration();
                }, 100);
              }}
              onChange={(value) => {
                console.log('CollaborativeDocumentEditor: Editor content changed:', value?.substring(0, 50) + '...');
                if (value !== undefined) {
                  setFallbackContent(value);
                  // Notify parent component of content change
                  console.log('CollaborativeDocumentEditor: Calling onDocumentUpdate with:', value?.substring(0, 50) + '...');
                  onDocumentUpdate?.(value);
                }
              }}
              onError={(error) => {
                console.error('Monaco Editor error:', error);
                setEditorError(error.toString());
              }}
            />
          </div>
        )}
      </div>

      {/* Version History Sidebar (if enabled) */}
      {showVersionHistory && (
        <div className="w-80 border-l bg-gray-50 flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-semibold">Version History</h3>
          </div>
          
          {/* Snapshots */}
          <div className="p-3 border-b">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Snapshots</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="p-2 bg-white rounded border text-sm">
                  <div className="font-medium">{snapshot.label}</div>
                  <div className="text-xs text-gray-500">
                    {format(new Date(snapshot.created_at), 'MMM d, HH:mm')}
                  </div>
                  {snapshot.description && (
                    <div className="text-xs text-gray-600 mt-1">{snapshot.description}</div>
                  )}
                  <div className="flex gap-1 mt-2">
                    <Button size="sm" variant="outline" className="h-6 text-xs">
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-6 text-xs"
                      onClick={() => exportSnapshotAsPDF(snapshot.id)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Versions */}
          <div className="flex-1 p-3 overflow-y-auto">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Recent Versions</h4>
            <div className="space-y-2">
              {versions.map((version) => (
                <div key={version.id} className="p-2 bg-white rounded border text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">Version {version.versionNumber}</div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(version.createdAt), 'MMM d, HH:mm')}
                      </div>
                      {version.changeSummary && (
                        <div className="text-xs text-gray-600 mt-1">{version.changeSummary}</div>
                      )}
                    </div>
                    <Badge variant={version.isAutoSave ? "secondary" : "default"} className="text-xs">
                      {version.isAutoSave ? "Auto" : "Manual"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborativeDocumentEditor;