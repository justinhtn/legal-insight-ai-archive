
import React, { useState } from 'react';
import DocumentContent from './DocumentContent';
import DocumentTabManager from './DocumentTabManager';
import ExplorerHeader from './ExplorerHeader';
import RightPanel from './RightPanel';
import DocumentUploadModal from '../DocumentUploadModal';
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';
import { useQuery } from '@tanstack/react-query';
import { getClients, Client } from '@/services/clientService';
import { toast } from 'sonner';

const FileExplorerLayout: React.FC = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'chat' | 'client-info' | null>(null);
  
  const { selectedClientId, selectedFolderId } = useFileExplorer();
  const { openTabs, handleDocumentOpen } = useDocumentTabs();

  // Get selected client data
  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0] || null;
  
  console.log('FileExplorerLayout - selectedClientId:', selectedClientId);
  console.log('FileExplorerLayout - clients:', clients);
  console.log('FileExplorerLayout - selectedClient:', selectedClient);

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

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    toast.success('Files uploaded successfully');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ExplorerHeader
        isChatOpen={rightPanelOpen && rightPanelMode === 'chat'}
        isClientInfoOpen={rightPanelOpen && rightPanelMode === 'client-info'}
        onToggleChat={handleToggleChat}
        onToggleClientInfo={handleToggleClientInfo}
        selectedClientName={selectedClient?.name}
      />

      {/* Document Tabs - Show when tabs are open */}
      {openTabs.length > 0 && <DocumentTabManager />}

      {/* Main Content Layout - Use CSS Grid for better space distribution */}
      <div className={`flex-1 min-h-0 ${rightPanelOpen ? 'grid grid-cols-[1fr_400px]' : 'flex'}`}>
        {/* Document Content Area */}
        <div className="min-w-0 flex-1 overflow-auto">
          <DocumentContent />
        </div>

        {/* Right Panel - Chat or Client Info */}
        {rightPanelOpen && (
          <RightPanel
            isOpen={rightPanelOpen}
            mode={rightPanelMode}
            selectedClient={selectedClient || null}
            onClose={handleCloseRightPanel}
            onClientUpdated={handleClientUpdated}
            onOpenDocumentWithHighlights={handleDocumentOpen}
          />
        )}
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
