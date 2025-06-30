
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Folder, getFolders } from '@/services/clientService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import ClientInfoPanel from '../finder/ClientInfoPanel';
import FolderPanel from './FolderPanel';
import FilePanel from './FilePanel';
import ClientChatPanel from './ClientChatPanel';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  modified: string;
}

interface ClientContentPanelProps {
  client: Client;
  selectedFolderId?: string;
  onFolderSelect: (folderId: string | null) => void;
  onNewFolder: () => void;
  onUpload: () => void;
  onClientUpdated: (client: Client) => void;
  onOpenDocument?: (document: any) => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  onOpenDocumentWithHighlights?: (document: any, highlights: any[], query: string) => void;
}

const ClientContentPanel: React.FC<ClientContentPanelProps> = ({
  client,
  selectedFolderId,
  onFolderSelect,
  onNewFolder,
  onUpload,
  onClientUpdated,
  onOpenDocument,
  isChatOpen,
  onToggleChat,
  onOpenDocumentWithHighlights
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFolders();
  }, [client.id]);

  useEffect(() => {
    loadFiles();
  }, [selectedFolderId, client.id]);

  const loadFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const foldersData = await getFolders(client.id);
      setFolders(foldersData);
    } catch (error) {
      console.error('Error loading folders:', error);
      toast({
        title: "Error",
        description: "Failed to load folders",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const loadFiles = async () => {
    setIsLoadingFiles(true);
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('client_id', client.id);

      if (selectedFolderId) {
        query = query.eq('folder_id', selectedFolderId);
      } else {
        query = query.is('folder_id', null);
      }

      const { data: documents, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const fileItems: FileItem[] = (documents || []).map(doc => ({
        id: doc.id,
        name: doc.file_name,
        type: 'file' as const,
        size: doc.file_size,
        modified: doc.updated_at
      }));

      setFiles(fileItems);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "Error",
        description: "Failed to load files",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const refreshData = () => {
    loadFolders();
    loadFiles();
  };

  return (
    <div className="flex h-full">
      {/* Main Content Area */}
      <div className={`flex flex-col bg-white transition-all duration-300 ${isChatOpen ? 'flex-[3]' : 'flex-1'}`}>
        {/* Client Info Section with Chat Button */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex-1">
            <ClientInfoPanel
              client={client}
              onClientUpdated={onClientUpdated}
            />
          </div>
          <Button
            variant={isChatOpen ? "default" : "outline"}
            size="sm"
            onClick={onToggleChat}
            className="ml-4 flex items-center gap-2"
          >
            {isChatOpen ? (
              <>
                <X className="h-4 w-4" />
                Close Chat
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                Chat about {client.name}'s case
              </>
            )}
          </Button>
        </div>

        {/* Folders Section */}
        <div className="border-b">
          <FolderPanel
            folders={folders}
            selectedFolderId={selectedFolderId}
            onFolderSelect={onFolderSelect}
            onNewFolder={onNewFolder}
            isLoading={isLoadingFolders}
          />
        </div>

        {/* Files Section */}
        <div className="flex-1">
          <FilePanel
            files={files}
            selectedFolderId={selectedFolderId}
            folderName={selectedFolderId ? folders.find(f => f.id === selectedFolderId)?.name : null}
            onUpload={onUpload}
            isLoading={isLoadingFiles}
            onRefresh={refreshData}
            onFileClick={onOpenDocument}
          />
        </div>
      </div>

      {/* Chat Panel - Slides in from right */}
      {isChatOpen && (
        <div className="flex-1 border-l transition-all duration-300 animate-in slide-in-from-right">
          <ClientChatPanel 
            client={client}
            onOpenDocumentWithHighlights={onOpenDocumentWithHighlights}
          />
        </div>
      )}
    </div>
  );
};

export default ClientContentPanel;
