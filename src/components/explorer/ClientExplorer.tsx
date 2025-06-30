
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClients, getFolders } from '@/services/clientService';
import { getDocuments } from '@/services/documentService';
import ClientSidebar from './ClientSidebar';
import FilePanel from './FilePanel';
import { useClientNavigation } from '@/hooks/useClientNavigation';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';
import { toast } from 'sonner';

interface ClientExplorerProps {
  onUpload: () => void;
  onRefresh: () => void;
  onNewClient: () => void;
}

const ClientExplorer: React.FC<ClientExplorerProps> = ({ onUpload, onRefresh, onNewClient }) => {
  const { selectedClientId, selectedFolderId, handleClientSelect, handleFolderClick, handleNavigateToRoot } = useClientNavigation();
  const { handleFileClick } = useDocumentTabs();

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  // Fetch folders for selected client
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['folders', selectedClientId],
    queryFn: () => selectedClientId ? getFolders(selectedClientId) : Promise.resolve([]),
    enabled: !!selectedClientId,
  });

  // Fetch documents for selected folder
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['documents', selectedFolderId],
    queryFn: () => selectedFolderId ? getDocuments(selectedFolderId) : Promise.resolve([]),
    enabled: !!selectedFolderId,
  });

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  const handleUploadClick = () => {
    if (!selectedClientId) {
      toast.error('Please select a client first');
      return;
    }
    onUpload();
  };

  const fileItems = documents.map(doc => ({
    id: doc.id,
    name: doc.name,
    type: 'file' as const,
    size: doc.size || 0,
    modified: doc.uploaded_at,
  }));

  return (
    <>
      {/* Client Sidebar - Always visible */}
      <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200">
        <ClientSidebar
          clients={clients}
          selectedClientId={selectedClientId}
          onClientSelect={handleClientSelect}
          onNewClient={onNewClient}
          isLoading={clientsLoading}
        />
      </div>

      {/* File Panel - Only show when client is selected */}
      {selectedClientId && (
        <div className="flex-1">
          <FilePanel
            files={fileItems}
            folders={folders}
            selectedFolderId={selectedFolderId}
            folderName={selectedFolder?.name}
            onUpload={handleUploadClick}
            isLoading={foldersLoading || documentsLoading}
            onRefresh={onRefresh}
            onFileClick={handleFileClick}
            onFolderClick={handleFolderClick}
            onNavigateToRoot={handleNavigateToRoot}
            allFolders={folders}
          />
        </div>
      )}
    </>
  );
};

export default ClientExplorer;
