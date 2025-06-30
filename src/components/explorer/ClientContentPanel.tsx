import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Folder, getFolders } from '@/services/clientService';
import { useToast } from '@/hooks/use-toast';
import ClientInfoPanel from '../finder/ClientInfoPanel';
import FolderPanel from './FolderPanel';
import FilePanel from './FilePanel';

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
}

const ClientContentPanel: React.FC<ClientContentPanelProps> = ({
  client,
  selectedFolderId,
  onFolderSelect,
  onNewFolder,
  onUpload,
  onClientUpdated,
  onOpenDocument
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
    <div className="flex-1 flex flex-col bg-white">
      {/* Client Info Section */}
      <div className="p-4 border-b">
        <ClientInfoPanel
          client={client}
          onClientUpdated={onClientUpdated}
        />
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
  );
};

export default ClientContentPanel;
