import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import { Textarea } from '@/components/ui/textarea';
// Removed YJS imports - using Supabase Realtime instead
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  Eye,
  Share,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Type,
  Copy,
  Clipboard,
  Edit3,
  ChevronDown,
  MessageSquare,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAccount } from '@/contexts/AccountContext';
import { format } from 'date-fns';
import ActiveCollaborators from './ActiveCollaborators';

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
  onVersionHistoryToggle: () => void;
  showVersionHistory: boolean;
  onDocumentUpdate?: (content: string) => void;
}


const CollaborativeDocumentEditor: React.FC<CollaborativeDocumentEditorProps> = ({
  documentId,
  documentTitle,
  initialContent,
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
  const [cursorDecorations, setCursorDecorations] = useState<string[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleLineCount, setVisibleLineCount] = useState(50);
  const [showLineNumbers, setShowLineNumbers] = useState(true); // Document setting
  const [zoomLevel, setZoomLevel] = useState(100); // Zoom percentage
  
  const { toast } = useToast();
  const { currentProfile, currentAccount } = useAccount();

  // Initialize collaborative editing function
  const initializeCollaboration = useCallback(async () => {
    console.log('🚀 initializeCollaboration called');
    console.log('🚀 editorRef.current:', !!editorRef.current);
    console.log('🚀 monacoRef.current:', !!monacoRef.current);
    console.log('🚀 currentProfile:', currentProfile);
    
    // Get current user directly from Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('🚀 Supabase user:', user);
    console.log('🚀 Auth error:', authError);
    
    if (!editorRef.current || !monacoRef.current) {
      console.log('❌ Editor not ready for collaboration - missing editor/monaco');
      return;
    }
    
    if (!user) {
      console.log('❌ No authenticated user found');
      return;
    }
    
    console.log('✅ Initializing collaborative editing with user:', user.email);

    // Set initial content in Monaco editor
    if (initialContent) {
      editorRef.current.setValue(initialContent);
    }

    // Set up Supabase Realtime for collaborative editing
    const channel = supabase.channel(`document-${documentId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: user.id }
      }
    });

    console.log('🔄 Setting up collaborative channel for document:', documentId);
    console.log('🔄 Current user:', user);

    // Listen for document content changes from other users
    channel.on('broadcast', { event: 'document_change' }, (payload: any) => {
      console.log('📡 Received document_change broadcast:', payload);
      console.log('📡 My user ID:', user.id);
      console.log('📡 Sender user ID:', payload.payload.userId);
      
      if (payload.payload.userId !== user.id && editorRef.current) {
        const currentContent = editorRef.current.getValue();
        console.log('📡 Incoming content length:', payload.payload.content?.length);
        console.log('📡 Current content length:', currentContent.length);
        
        if (currentContent !== payload.payload.content) {
          console.log('📡 Content differs, updating editor');
          const position = editorRef.current.getPosition();
          editorRef.current.setValue(payload.payload.content);
          if (position) {
            editorRef.current.setPosition(position);
          }
        } else {
          console.log('📡 Content is the same, no update needed');
        }
      } else if (payload.payload.userId === user.id) {
        console.log('📡 Ignoring own broadcast');
      } else {
        console.log('📡 Editor not ready or other issue');
      }
    });

    // Listen for cursor position updates
    channel.on('broadcast', { event: 'cursor_update' }, (payload: any) => {
      updateCollaboratorCursor(payload.payload);
    });

    // Listen for test messages (debug)
    channel.on('broadcast', { event: 'test_message' }, (payload: any) => {
      console.log('🧪 Received test message:', payload);
      if (payload.payload.userId !== user.id) {
        toast({
          title: "Test Message Received",
          description: payload.payload.message,
          duration: 3000,
        });
      }
    });

    // Track user presence (who's online)
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      updateCollaboratorsList(presenceState);
    });

    // Subscribe to the channel
    channel.subscribe(async (status: string) => {
      console.log('🔔 Channel subscription status:', status);
      console.log('🔔 Channel name:', `document-${documentId}`);
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        
        // Track user presence
        const presenceData = {
          user_id: user.id,
          user_email: user.email,
          user_name: user.user_metadata?.name || user.email,
          online_at: new Date().toISOString(),
        };
        
        console.log('🔔 Tracking presence with data:', presenceData);
        await channel.track(presenceData);
        
        console.log('✅ Connected to collaborative editing channel');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error occurred');
        setIsConnected(false);
      } else if (status === 'TIMED_OUT') {
        console.error('⏰ Channel subscription timed out');
        setIsConnected(false);
      } else {
        console.log('🔄 Channel status:', status);
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
          console.log('📤 Broadcasting document change from user:', user.id);
          console.log('📤 Content length being broadcast:', content.length);
          
          channel.send({
            type: 'broadcast',
            event: 'document_change',
            payload: {
              userId: user.id,
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
              userId: user.id,
              userName: user.user_metadata?.name || user.email,
              userEmail: user.email,
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
  }, [documentId]);

  // Helper function to update collaborator cursor positions
  const updateCollaboratorCursor = useCallback((payload: any) => {
    setCollaborators(prev => {
      const existing = prev.find(c => c.id === payload.userId);
      if (existing) {
        return prev.map(collaborator => 
          collaborator.id === payload.userId
            ? { 
                ...collaborator, 
                cursor: {
                  line: payload.position.lineNumber,
                  column: payload.position.column
                }
              }
            : collaborator
        );
      } else {
        // Add new collaborator if not found
        const newCollaborator: CollaboratorInfo = {
          id: payload.userId,
          name: payload.userName || 'Anonymous',
          email: payload.userEmail || '',
          color: COLLABORATOR_COLORS[prev.length % COLLABORATOR_COLORS.length],
          cursor: {
            line: payload.position.lineNumber,
            column: payload.position.column
          },
          isActive: true
        };
        return [...prev, newCollaborator];
      }
    });
  }, []);

  // Helper function to update collaborators list from presence state
  const updateCollaboratorsList = useCallback((presenceState: any) => {
    const collaboratorsList: CollaboratorInfo[] = [];
    
    Object.entries(presenceState).forEach(([profileId, presences]: [string, any]) => {
      if (profileId !== currentProfile?.id && presences.length > 0) {
        const presence = presences[0];
        collaboratorsList.push({
          id: presence.profile_id,
          name: presence.profile_name || 'Anonymous',
          email: '', // We don't broadcast email for privacy
          color: COLLABORATOR_COLORS[collaboratorsList.length % COLLABORATOR_COLORS.length],
          isActive: true
        });
      }
    });
    
    setCollaborators(collaboratorsList);
  }, [currentProfile?.id]);

  // Function to render collaborator cursors in Monaco editor
  const renderCollaboratorCursors = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;

    // Clear existing decorations
    const newDecorations = editorRef.current.deltaDecorations(cursorDecorations, []);
    
    // Create new decorations for each collaborator
    const decorations: any[] = [];
    
    collaborators.forEach((collaborator, index) => {
      if (collaborator.cursor && collaborator.isActive) {
        const { line, column } = collaborator.cursor;
        
        // Create cursor line decoration
        decorations.push({
          range: new monacoRef.current.Range(line, column, line, column + 1),
          options: {
            className: `collaborator-cursor collaborator-cursor-${index}`,
            beforeContentClassName: `collaborator-cursor-before collaborator-cursor-before-${index}`,
            afterContentClassName: `collaborator-cursor-after collaborator-cursor-after-${index}`,
            minimap: {
              color: collaborator.color,
              position: monacoRef.current.editor.MinimapPosition.Inline
            },
            overviewRuler: {
              color: collaborator.color,
              position: monacoRef.current.editor.OverviewRulerLane.Full
            }
          }
        });

        // Create user name label decoration
        decorations.push({
          range: new monacoRef.current.Range(line, column, line, column),
          options: {
            afterContentClassName: `collaborator-label collaborator-label-${index}`,
            after: {
              content: `${collaborator.name}`,
              backgroundColor: collaborator.color,
              color: '#fff'
            }
          }
        });
      }
    });

    // Apply decorations and store their IDs
    const newDecorationIds = editorRef.current.deltaDecorations([], decorations);
    setCursorDecorations(newDecorationIds);
  }, [collaborators, cursorDecorations]);

  // Update cursors when collaborators change
  useEffect(() => {
    renderCollaboratorCursors();
  }, [collaborators, renderCollaboratorCursors]);

  // Update document embeddings after save
  const updateDocumentEmbeddings = async (docId: string) => {
    try {
      const { error } = await supabase.functions.invoke('update-embeddings', {
        body: { documentId: docId }
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
      console.log('Recording collaborative session for profile:', currentProfile?.id);
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
      {/* Collaborator Cursor Styles and Legal Document Formatting */}
      <style jsx global>{`
        .collaborator-cursor {
          border-left: 2px solid var(--collaborator-color);
          animation: blink 1s infinite;
        }
        
        .collaborator-cursor-before::before {
          content: '';
          position: absolute;
          top: 0;
          left: -2px;
          width: 0;
          height: 0;
          border-left: 6px solid var(--collaborator-color);
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
        }
        
        .collaborator-label {
          position: relative;
        }
        
        .collaborator-label::after {
          position: absolute;
          top: -20px;
          left: 0;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
          white-space: nowrap;
          z-index: 1000;
          pointer-events: none;
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
        
        /* Legal Document Line Numbers - Custom Overlay */
        .legal-line-numbers {
          position: absolute;
          left: 0;
          top: 0; /* Start from very top of document */
          bottom: 0; /* Go to very bottom */
          width: ${Math.round(70 * (zoomLevel / 100))}px;
          background-color: white;
          border-right: 2px solid #333;
          z-index: 10;
          font-family: 'Times', 'Times New Roman', serif;
          font-size: ${Math.round(14 * (zoomLevel / 100))}px;
          line-height: ${Math.round(21 * (zoomLevel / 100))}px; /* Match Monaco's line height */
          color: #333;
          padding-right: ${Math.round(8 * (zoomLevel / 100))}px;
          padding-top: ${Math.round(48 * (zoomLevel / 100))}px; /* Add padding to align with text */
          text-align: right;
          pointer-events: none;
          overflow: hidden;
        }
        
        .legal-line-numbers .line-number {
          height: ${Math.round(21 * (zoomLevel / 100))}px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: ${Math.round(8 * (zoomLevel / 100))}px;
        }
        
        /* Force Monaco editor content to respect the line number margin */
        .monaco-editor .view-lines {
          margin-left: 40px !important;
        }
        
        .monaco-editor .editor-scrollable {
          margin-left: 40px !important;
        }
        
        .monaco-editor .monaco-scrollable-element {
          margin-left: 40px !important;
        }
        
        /* Hide Monaco's unwanted visual elements */
        .monaco-editor .current-line {
          border: none !important;
        }
        
        .monaco-editor .view-cursor {
          border-left: 2px solid #000 !important;
        }
        
        .monaco-editor .cursor {
          border-left: 2px solid #000 !important;
        }
        
        .monaco-editor .focus-tracker {
          display: none !important;
        }
        
        .monaco-editor .margin-view-overlays {
          border-right: none !important;
        }
        
        /* Hide the blue line - likely overview ruler or guides */
        .monaco-editor .overview-ruler {
          display: none !important;
        }
        
        .monaco-editor .minimap {
          display: none !important;
        }
        
        .monaco-editor .decorationsOverviewRuler {
          display: none !important;
        }
        
        .monaco-editor .overview-ruler-decoration {
          display: none !important;
        }
        
        .monaco-editor .glyph-margin {
          display: none !important;
        }
        
        .monaco-editor .margin-view-overlays .current-line {
          border: none !important;
          background: none !important;
        }
        
        /* Override VS Code focus border - this is the blue line! */
        .monaco-editor {
          --vscode-focusBorder: transparent !important;
          --vscode-editorIndentGuide-background: transparent !important;
        }
        
        .monaco-editor .monaco-editor-background {
          --vscode-focusBorder: transparent !important;
        }
        
        /* Individual collaborator colors */
        ${collaborators.map((collaborator, index) => `
          .collaborator-cursor-${index} {
            --collaborator-color: ${collaborator.color};
            border-left-color: ${collaborator.color} !important;
          }
          
          .collaborator-cursor-before-${index}::before {
            border-left-color: ${collaborator.color} !important;
          }
          
          .collaborator-label-${index}::after {
            background-color: ${collaborator.color} !important;
            color: white !important;
          }
        `).join('')}
      `}</style>
      
      {/* Single Unified Toolbar - Google Docs Style */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-white">
        {/* Left: Document Name (Large & Editable) */}
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-500" />
          <input 
            type="text"
            value={documentTitle}
            onChange={(e) => {
              // Handle document title change - you can add save logic here
              console.log('Document title changed to:', e.target.value);
            }}
            className="text-lg font-medium text-gray-900 bg-transparent border-none outline-none focus:bg-gray-50 focus:px-3 focus:py-1 focus:rounded max-w-80"
            placeholder="Untitled document"
          />
          {isLocked && <Lock className="h-4 w-4 text-red-500" />}
        </div>

        {/* Menu Dropdowns */}
        <div className="flex items-center gap-1">
          {/* File Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-sm">
                File
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={handleSave}>
                <Save className="h-4 w-4 mr-3" />
                Save
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-3" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-sm">
                Edit
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-3" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Clipboard className="h-4 w-4 mr-3" />
                Paste
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Format Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-sm">
                Format
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem>
                <Type className="h-4 w-4 mr-3" />
                Font
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bold className="h-4 w-4 mr-3" />
                Text Style
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tools Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-sm">
                Tools
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setShowLineNumbers(!showLineNumbers)}>
                <Type className="h-4 w-4 mr-3" />
                {showLineNumbers ? 'Hide' : 'Show'} Line Numbers
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-3" />
                Preferences
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center: Essential Formatting Tools Only */}
        <div className="flex items-center gap-1 flex-1">
          {/* Quick Formatting */}
          <div className="flex items-center">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Bold className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Italic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Underline className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <div className="flex items-center">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <div className="flex items-center">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <List className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ListOrdered className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right: Clean Status & Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
              disabled={zoomLevel <= 50}
            >
              -
            </Button>
            <span className="text-sm text-gray-600 min-w-12 text-center">
              {zoomLevel}%
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
              disabled={zoomLevel >= 200}
            >
              +
            </Button>
          </div>

          {/* Connected Status */}
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">{isConnected ? 'Connected' : 'Offline'}</span>
          </div>

          {/* Mode Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 gap-2 text-sm">
                <Edit3 className="h-4 w-4" />
                Editing
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem>
                <Edit3 className="h-4 w-4 mr-3" />
                <div>
                  <div className="font-medium">Editing</div>
                  <div className="text-xs text-gray-500">Edit document directly</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageSquare className="h-4 w-4 mr-3" />
                <div>
                  <div className="font-medium">Suggesting</div>
                  <div className="text-xs text-gray-500">Edits become suggestions</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Eye className="h-4 w-4 mr-3" />
                <div>
                  <div className="font-medium">Viewing</div>
                  <div className="text-xs text-gray-500">Read or print final document</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Share Button */}
          <Button variant="outline" size="sm" className="h-8 px-3 text-sm">
            <Share className="h-4 w-4 mr-1" />
            Share
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

      {/* Editor with Google Docs-style page layout */}
      <div className="flex-1 relative overflow-hidden bg-gray-100">
        {editorError ? (
          // Fallback textarea if Monaco fails
          <div className="w-full h-full p-4 bg-gray-100 flex justify-center">
            <div className="w-full max-w-4xl bg-white shadow-sm p-8 mx-4 my-6">
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
                className="w-full h-full resize-none border-none shadow-none focus:ring-0 text-base leading-relaxed"
                placeholder="Document content..."
                style={{ fontFamily: 'Times, "Times New Roman", serif' }}
              />
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gray-100 flex justify-center overflow-auto">
            {/* 8.5x11 page container */}
            <div 
              className="mx-4 my-6 bg-white shadow-sm rounded-lg relative overflow-hidden" 
              style={{
                aspectRatio: '8.5 / 11',
                minHeight: `calc(11 * 96px * ${zoomLevel / 100})`, // 11 inches at 96 DPI with zoom
                width: `calc(8.5 * 96px * ${zoomLevel / 100})`, // 8.5 inches at 96 DPI with zoom
                maxWidth: `${816 * (zoomLevel / 100)}px`, // 8.5 * 96 with zoom
                transform: `scale(1)`, // Keep at scale 1, size handles zoom
                transformOrigin: 'top center'
              }}
            >
              {/* Custom Legal Line Numbers - Conditional */}
              {showLineNumbers && (
                <div className="legal-line-numbers">
                  <div 
                    style={{ 
                      transform: `translateY(-${scrollTop}px)`,
                      transition: 'none'
                    }}
                  >
                    {Array.from({ length: Math.max(visibleLineCount, 100) }, (_, i) => (
                      <div key={i} className="line-number">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Editor
                height="100%"
                width="100%"
                defaultLanguage="plaintext"
                value={initialContent}
                theme="vs-light"
                loading={<div className="flex items-center justify-center h-full text-gray-500">Loading Monaco Editor...</div>}
                options={{
                  fontSize: Math.round(14 * (zoomLevel / 100)),
                  fontFamily: 'Times, "Times New Roman", serif',
                  lineNumbers: 'off',
                  wordWrap: 'on',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: true,
                  automaticLayout: true,
                  folding: false,
                  renderWhitespace: 'none',
                  rulers: [],
                  bracketPairColorization: { enabled: false },
                  readOnly: false,
                  padding: { 
                    top: Math.round(48 * (zoomLevel / 100)), 
                    bottom: Math.round(48 * (zoomLevel / 100)), 
                    left: showLineNumbers ? Math.round(115 * (zoomLevel / 100)) : Math.round(48 * (zoomLevel / 100)), // Conditional left padding with zoom
                    right: Math.round(48 * (zoomLevel / 100))
                  },
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto'
                  },
                  overviewRulerBorder: false,
                  hideCursorInOverviewRuler: true,
                  overviewRulerLanes: 0,
                  glyphMargin: false,
                  lineDecorationsWidth: 0,
                  renderLineHighlight: 'none',
                  renderIndentGuides: false,
                  renderValidationDecorations: 'off',
                  showFoldingControls: 'never',
                  fontLigatures: false,
                  cursorBlinking: 'solid',
                  cursorWidth: 2,
                  cursorStyle: 'line'
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
                  
                  // Add scroll listener to sync line numbers
                  editor.onDidScrollChange((e) => {
                    setScrollTop(e.scrollTop);
                  });
                  
                  // Update visible line count when content changes
                  const model = editor.getModel();
                  if (model) {
                    const updateLineCount = () => {
                      const lineCount = model.getLineCount();
                      setVisibleLineCount(Math.max(lineCount + 10, 50)); // Add buffer lines
                    };
                    
                    updateLineCount();
                    model.onDidChangeContent(updateLineCount);
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