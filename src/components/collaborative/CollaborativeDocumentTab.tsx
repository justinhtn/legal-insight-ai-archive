import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Users, 
  History, 
  Settings,
  Eye,
  Edit3,
  Lock,
  Unlock,
  Share2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CollaborativeDocumentEditor from './CollaborativeDocumentEditor';
import VersionHistoryPanel from './VersionHistoryPanel';
import DocumentSharingModal from './DocumentSharingModal';

interface DocumentTabData {
  id: string;
  title: string;
  content: string;
  highlights: Array<{
    text: string;
    page?: number;
    lines?: string;
  }>;
  query: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
}

interface CollaborativeDocumentTabProps {
  document: DocumentTabData;
  currentUser: User;
  onClose: () => void;
  onDocumentUpdate?: (content: string) => void;
}

const CollaborativeDocumentTab: React.FC<CollaborativeDocumentTabProps> = ({
  document,
  currentUser,
  onClose,
  onDocumentUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'view'>('edit');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [isCollaborative, setIsCollaborative] = useState(true);
  const [documentLock, setDocumentLock] = useState<any>(null);
  const [collaboratorCount, setCollaboratorCount] = useState(0);
  const [currentContent, setCurrentContent] = useState(document.content);
  
  const { toast } = useToast();

  // Check if document is locked
  useEffect(() => {
    checkDocumentLock();
    getCollaboratorCount();
    
    // Set up real-time listeners for collaborative sessions
    const collaborationChannel = supabase
      .channel(`document-${document.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collaborative_sessions',
          filter: `document_id=eq.${document.id}`
        },
        () => {
          getCollaboratorCount();
        }
      )
      .subscribe();

    const lockChannel = supabase
      .channel(`document-locks-${document.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_locks',
          filter: `document_id=eq.${document.id}`
        },
        () => {
          checkDocumentLock();
        }
      )
      .subscribe();

    return () => {
      collaborationChannel.unsubscribe();
      lockChannel.unsubscribe();
    };
  }, [document.id]);

  const checkDocumentLock = async () => {
    try {
      const { data, error } = await supabase
        .from('document_locks')
        .select('*, user:user_id(email)')
        .eq('document_id', document.id)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      setDocumentLock(data);
    } catch (error) {
      console.error('Error checking document lock:', error);
    }
  };

  const getCollaboratorCount = async () => {
    try {
      const { data, error } = await supabase
        .from('collaborative_sessions')
        .select('user_id')
        .eq('document_id', document.id)
        .eq('is_active', true)
        .gte('last_activity', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Active in last 5 minutes

      if (error) throw error;

      setCollaboratorCount(data?.length || 0);
    } catch (error) {
      console.error('Error getting collaborator count:', error);
    }
  };

  const toggleDocumentLock = async () => {
    try {
      if (documentLock) {
        // Remove lock
        const { error } = await supabase
          .from('document_locks')
          .update({ is_active: false })
          .eq('id', documentLock.id);

        if (error) throw error;

        toast({
          title: "Document Unlocked",
          description: "Document is now available for editing by all users",
        });
      } else {
        // Add lock
        const { error } = await supabase
          .from('document_locks')
          .insert({
            document_id: document.id,
            user_id: currentUser.id,
            lock_type: 'exclusive',
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
            is_active: true
          });

        if (error) throw error;

        toast({
          title: "Document Locked",
          description: "Document is now locked for exclusive editing",
        });
      }

      checkDocumentLock();
    } catch (error) {
      console.error('Error toggling document lock:', error);
      toast({
        title: "Error",
        description: "Failed to update document lock",
        variant: "destructive"
      });
    }
  };

  const handleDocumentContentUpdate = (content: string) => {
    console.log('CollaborativeDocumentTab: Document content updated, length:', content.length);
    setCurrentContent(content);
    onDocumentUpdate?.(content);
  };

  const handleVersionRestore = (content: string) => {
    // This would restore the content in the collaborative editor
    console.log('CollaborativeDocumentTab: Version restore, calling onDocumentUpdate');
    handleDocumentContentUpdate(content);
    toast({
      title: "Version Restored",
      description: "Document has been restored to the selected version",
    });
  };

  const handleSnapshotCreate = (label: string, description?: string) => {
    // This would be handled by the collaborative editor
    toast({
      title: "Snapshot Created",
      description: `"${label}" snapshot has been created`,
    });
  };

  const toggleVersionHistory = () => {
    setShowVersionHistory(!showVersionHistory);
  };

  const isLocked = documentLock && documentLock.user_id !== currentUser.id;
  const isLockedByCurrentUser = documentLock?.user_id === currentUser.id;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-gray-500" />
          <h2 className="font-semibold text-gray-900 truncate">{document.title}</h2>
          
          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {isCollaborative && (
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {collaboratorCount} active
              </Badge>
            )}
            
            {isLocked && (
              <Badge variant="destructive" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Locked by {documentLock.user?.email}
              </Badge>
            )}
            
            {isLockedByCurrentUser && (
              <Badge variant="default" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                You locked this
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Lock/Unlock toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleDocumentLock}
            disabled={isLocked}
          >
            {documentLock ? (
              <>
                <Unlock className="h-3 w-3 mr-1" />
                Unlock
              </>
            ) : (
              <>
                <Lock className="h-3 w-3 mr-1" />
                Lock
              </>
            )}
          </Button>

          {/* Share button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSharingModal(true)}
          >
            <Share2 className="h-3 w-3 mr-1" />
            Share
          </Button>

          {/* Version History toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleVersionHistory}
            className={showVersionHistory ? 'bg-blue-50 border-blue-300' : ''}
          >
            <History className="h-3 w-3 mr-1" />
            History
          </Button>

          {/* Close button */}
          <Button variant="outline" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex">
        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'edit' | 'view')} className="flex flex-col h-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0">
              <TabsTrigger 
                value="edit" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent"
                disabled={isLocked}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
                {isLocked && <Lock className="h-3 w-3 ml-2 text-red-500" />}
              </TabsTrigger>
              <TabsTrigger 
                value="view"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Only
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="flex-1 m-0 h-full overflow-hidden">
              {isCollaborative && !isLocked ? (
                <CollaborativeDocumentEditor
                  documentId={document.id}
                  documentTitle={document.title}
                  initialContent={currentContent}
                  onVersionHistoryToggle={toggleVersionHistory}
                  showVersionHistory={false} // Handled separately
                  onDocumentUpdate={handleDocumentContentUpdate}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <div className="text-center text-gray-500">
                    <Lock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">Document Locked</h3>
                    <p className="text-sm">
                      {isLocked 
                        ? `This document is locked by ${documentLock.user?.email}` 
                        : 'Collaborative editing is not available'
                      }
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="view" className="flex-1 m-0">
              <div className="h-full p-6 overflow-auto">
                <div className="prose prose-sm max-w-none font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {currentContent}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Version History Sidebar */}
        {showVersionHistory && (
          <VersionHistoryPanel
            documentId={document.id}
            currentUserId={currentUser.id}
            onVersionRestore={handleVersionRestore}
            onSnapshotCreate={handleSnapshotCreate}
          />
        )}
      </div>

      {/* Document Sharing Modal */}
      <DocumentSharingModal
        documentId={document.id}
        documentTitle={document.title}
        isOpen={showSharingModal}
        onClose={() => setShowSharingModal(false)}
        currentUserId={currentUser.id}
      />
    </div>
  );
};

export default CollaborativeDocumentTab;