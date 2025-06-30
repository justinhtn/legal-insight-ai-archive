
import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import DocumentTabManager from './DocumentTabManager';
import ClientExplorer from './ClientExplorer';
import TabbedDocumentViewer from './TabbedDocumentViewer';
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
  
  const { selectedClientId, selectedFolderId } = useFileExplorer();
  const { openTabs, activeTabId, showOverview, handleDocumentOpen } = useDocumentTabs();

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

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <ExplorerHeader
        isChatOpen={rightPanelOpen && rightPanelMode === 'chat'}
        isClientInfoOpen={rightPanelOpen && rightPanelMode === 'client-info'}
        onToggleChat={handleToggleChat}
        onToggleClientInfo={handleToggleClientInfo}
        selectedClientName={selectedClient?.name}
      />

      {/* Document Tabs - Always visible when there are open tabs */}
      {openTabs.length > 0 && <DocumentTabManager />}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Client Explorer - Always visible */}
        <ClientExplorer
          onUpload={handleUpload}
          onRefresh={handleRefresh}
          onNewClient={handleNewClient}
        />

        {/* Main Content Panel */}
        <div className="flex-1 flex flex-col">
          {/* Document Viewer - Only show when there are open tabs and not showing overview */}
          {openTabs.length > 0 && !showOverview && activeTabId ? (
            <TabbedDocumentViewer
              tabs={openTabs}
              activeTabId={activeTabId}
              onTabChange={() => {}} // Handled by context
              onTabClose={() => {}} // Handled by context
              onShowOverview={() => {}} // Handled by context
              showOverview={showOverview}
              showTabsOnly={false}
            />
          ) : (
            /* Welcome message when no client is selected or showing overview */
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  {!selectedClientId ? 'Welcome to Legal Document Manager' : 'Overview'}
                </h2>
                <p className="text-gray-500 text-lg">
                  {!selectedClientId 
                    ? 'Select a client from the sidebar to view their files and folders'
                    : 'Select a document to view its contents'
                  }
                </p>
              </div>
            </div>
          )}
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
