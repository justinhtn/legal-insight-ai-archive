import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
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
}

const COLLABORATOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];

const CollaborativeDocumentEditor: React.FC<CollaborativeDocumentEditorProps> = ({
  documentId,
  documentTitle,
  initialContent,
  currentUser,
  onVersionHistoryToggle,
  showVersionHistory
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const yjsDocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([]);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  
  const { toast } = useToast();

  // Initialize collaborative editing
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    // Create Yjs document
    const yjsDoc = new Y.Doc();
    yjsDocRef.current = yjsDoc;

    // Connect to WebSocket provider (you'll need to set up a YJS WebSocket server)
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/yjs`;
    const provider = new WebsocketProvider(wsUrl, `document-${documentId}`, yjsDoc);
    providerRef.current = provider;

    // Set up Monaco binding
    const yText = yjsDoc.getText('monaco');
    const binding = new MonacoBinding(
      yText,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      provider.awareness
    );
    bindingRef.current = binding;

    // Set initial content if document is empty
    if (yText.length === 0 && initialContent) {
      yText.insert(0, initialContent);
    }

    // Set up awareness (user presence)
    provider.awareness.setLocalStateField('user', {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      color: COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)]
    });

    // Listen for awareness changes (other users)
    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().entries());
      const collaboratorsList: CollaboratorInfo[] = states
        .filter(([clientId, state]) => clientId !== provider.awareness.clientID)
        .map(([clientId, state]) => ({
          id: state.user?.id || clientId.toString(),
          name: state.user?.name || 'Anonymous',
          email: state.user?.email || '',
          color: state.user?.color || '#999',
          isActive: true
        }));
      
      setCollaborators(collaboratorsList);
    });

    // Connection status
    provider.on('status', (event: any) => {
      setIsConnected(event.status === 'connected');
    });

    // Auto-save on changes
    const autoSaveInterval = setInterval(() => {
      if (yText.length > 0) {
        saveVersion(yText.toString(), true);
      }
    }, 30000); // Auto-save every 30 seconds

    // Record collaborative session
    recordSession();

    return () => {
      clearInterval(autoSaveInterval);
      binding?.destroy();
      provider?.disconnect();
      yjsDoc?.destroy();
    };
  }, [documentId, currentUser]);

  // Record collaborative session in database
  const recordSession = async () => {
    try {
      const userColor = COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)];
      
      await supabase
        .from('collaborative_sessions')
        .insert({
          document_id: documentId,
          user_id: currentUser.id,
          user_color: userColor,
          is_active: true
        });
    } catch (error) {
      console.error('Error recording session:', error);
    }
  };

  // Save document version
  const saveVersion = async (content: string, isAutoSave: boolean = false) => {
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .insert({
          document_id: documentId,
          content,
          created_by: currentUser.id,
          is_auto_save: isAutoSave,
          change_summary: isAutoSave ? 'Auto-save' : 'Manual save',
          content_delta: yjsDocRef.current ? Y.encodeStateAsUpdate(yjsDocRef.current) : null
        })
        .select()
        .single();

      if (error) throw error;

      setLastSaved(new Date());
      
      if (!isAutoSave) {
        toast({
          title: "Document Saved",
          description: `Version ${data.version_number} saved successfully`,
        });
      }

      // Update document's current version
      await supabase
        .from('documents')
        .update({
          content,
          current_version: data.version_number,
          last_collaboration_activity: new Date().toISOString()
        })
        .eq('id', documentId);

      loadVersions();
    } catch (error) {
      console.error('Error saving version:', error);
      toast({
        title: "Save Error",
        description: "Failed to save document version",
        variant: "destructive"
      });
    }
  };

  // Create snapshot
  const createSnapshot = async (label: string, description?: string) => {
    if (!yjsDocRef.current) return;

    setIsCreatingSnapshot(true);
    try {
      const content = yjsDocRef.current.getText('monaco').toString();
      
      // First create a version
      const { data: versionData, error: versionError } = await supabase
        .from('document_versions')
        .insert({
          document_id: documentId,
          content,
          created_by: currentUser.id,
          is_auto_save: false,
          change_summary: `Snapshot: ${label}`,
          content_delta: Y.encodeStateAsUpdate(yjsDocRef.current)
        })
        .select()
        .single();

      if (versionError) throw versionError;

      // Then create the snapshot
      const { error: snapshotError } = await supabase
        .from('document_snapshots')
        .insert({
          document_id: documentId,
          version_id: versionData.id,
          label,
          description,
          created_by: currentUser.id
        });

      if (snapshotError) throw snapshotError;

      toast({
        title: "Snapshot Created",
        description: `"${label}" snapshot saved successfully`,
      });

      loadSnapshots();
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

  // Load versions
  const loadVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .select(`
          *,
          created_by_user:created_by(email)
        `)
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(10);

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  };

  // Load snapshots
  const loadSnapshots = async () => {
    try {
      const { data, error } = await supabase
        .from('document_snapshots')
        .select(`
          *,
          created_by_user:created_by(email),
          version:document_versions(version_number)
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSnapshots(data || []);
    } catch (error) {
      console.error('Error loading snapshots:', error);
    }
  };

  // Manual save
  const handleSave = () => {
    if (yjsDocRef.current) {
      const content = yjsDocRef.current.getText('monaco').toString();
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

  return (
    <div className="h-full flex flex-col bg-white">
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
      <div className="flex-1">
        <Editor
          defaultLanguage="plaintext"
          defaultValue={initialContent}
          theme="vs"
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
            bracketPairColorization: { enabled: false }
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
          }}
        />
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