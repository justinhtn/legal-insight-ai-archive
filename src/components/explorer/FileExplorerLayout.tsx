
import React, { useState } from 'react';
import DocumentContent from './DocumentContent';
import DocumentTabManager from './DocumentTabManager';
import ExplorerHeader from './ExplorerHeader';
import RightPanel from './RightPanel';
import DocumentUploadModal from '../DocumentUploadModal';
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';
import { useQuery } from '@tanstack/react-query';
import { getClients, getFolders, Client } from '@/services/clientService';
import { getDocuments } from '@/services/documentService';
import { toast } from 'sonner';

const FileExplorerLayout: React.FC = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'chat' | 'client-info' | null>(null);
  
  const { selectedClientId, selectedFolderId, showOverview, openTabs } = useFileExplorer();
  const { handleDocumentOpen } = useDocumentTabs();

  // Get selected client data
  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const { refetch: refetchFolders } = useQuery({
    queryKey: ['folders', selectedClientId],
    queryFn: () => selectedClientId ? getFolders(selectedClientId) : Promise.resolve([]),
    enabled: !!selectedClientId,
  });

  const { refetch: refetchDocuments } = useQuery({
    queryKey: ['documents', selectedFolderId],
    queryFn: () => selectedFolderId ? getDocuments(selectedFolderId) : Promise.resolve([]),
    enabled: !!selectedFolderId,
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleToggleChat = () => {
    if (rightPanelOpen && rightPanelMode === 'chat') {
      setRightPanelOpen(false);
      setRightPanelMode(null);
    } else {
      setRightPanelOpen(true);
      setRightPanelMode('chat');
    }
  };

  const handleToggleClientInfo = () => {
    if (rightPanelOpen && rightPanelMode === 'client-info') {
      setRightPanelOpen(false);
      setRightPanelMode(null);
    } else {
      setRightPanelOpen(true);
      setRightPanelMode('client-info');
    }
  };

  const handleCloseRightPanel = () => {
    setRightPanelOpen(false);
    setRightPanelMode(null);
  };

  const handleClientUpdated = (updatedClient: Client) => {
    refetchClients();
    toast.success('Client information updated successfully');
  };

  const handleUpload = () => {
    if (!selectedClientId) {
      toast.error('Please select a client first');
      return;
    }
    setShowUploadModal(true);
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    refetchFolders();
    refetchDocuments();
    toast.success('Files uploaded successfully');
  };

  const handleRefresh = () => {
    refetchFolders();
    refetchDocuments();
  };

  const handleNewClient = () => {
    toast.info('Client creation feature coming soon');
  };

  // Always show overview tab
  const shouldShowTabs = true;

  return (
    <div className="app-layout">
      {/* Header */}
      <ExplorerHeader
        isChatOpen={rightPanelOpen && rightPanelMode === 'chat'}
        isClientInfoOpen={rightPanelOpen && rightPanelMode === 'client-info'}
        onToggleChat={handleToggleChat}
        onToggleClientInfo={handleToggleClientInfo}
        selectedClientName={selectedClient?.name}
      />

      {/* Document Tabs - Always show with overview tab */}
      {shouldShowTabs && <DocumentTabManager />}

      {/* Main Layout */}
      <div className="main-layout">
        {/* Document Content Area - Full width since explorer is now in sidebar */}
        <div className={`main-content full-width ${rightPanelOpen ? 'chat-open' : ''}`}>
          <DocumentContent />
        </div>

        {/* Right Panel - Chat or Client Info */}
        <RightPanel
          isOpen={rightPanelOpen}
          mode={rightPanelMode}
          selectedClient={selectedClient || null}
          onClose={handleCloseRightPanel}
          onClientUpdated={handleClientUpdated}
          onOpenDocumentWithHighlights={handleDocumentOpen}
        />
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <DocumentUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUploadSuccess}
          selectedClientId={selectedClientId}
          selectedFolderId={selectedFolderId}
        />
      )}
    </div>
  );
};

export default FileExplorerLayout;
