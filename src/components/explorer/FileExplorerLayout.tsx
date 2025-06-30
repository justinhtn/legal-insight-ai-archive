
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

  // Calculate main content width based on panel states
  const getMainContentStyle = () => {
    const leftSidebarWidth = 280;
    const rightPanelWidth = rightPanelOpen ? 400 : 0;
    const rightIconBarWidth = 64;
    
    return {
      width: `calc(100% - ${leftSidebarWidth + rightPanelWidth + rightIconBarWidth}px)`,
      marginLeft: `${leftSidebarWidth}px`,
      marginRight: `${rightPanelWidth + rightIconBarWidth}px`
    };
  };

  return (
    <div className="h-screen flex flex-col bg-white relative">
      {/* Header */}
      <ExplorerHeader
        isChatOpen={rightPanelOpen && rightPanelMode === 'chat'}
        isClientInfoOpen={rightPanelOpen && rightPanelMode === 'client-info'}
        onToggleChat={handleToggleChat}
        onToggleClientInfo={handleToggleClientInfo}
        selectedClientName={selectedClient?.name}
      />

      {/* Main Layout Container */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Client Explorer - Fixed Left Sidebar */}
        <div className="fixed left-0 top-12 bottom-0 w-70 z-10">
          <ClientExplorer
            onUpload={handleUpload}
            onRefresh={handleRefresh}
            onNewClient={handleNewClient}
          />
        </div>

        {/* Main Content Area - Dynamic Width */}
        <div 
          className="flex flex-col transition-all duration-300 ease-in-out bg-white"
          style={getMainContentStyle()}
        >
          {/* Document Tabs - Always show at least Overview */}
          <DocumentTabManager />

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {!showOverview && activeTabId ? (
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
              /* Overview or Welcome Content */
              <div className="flex-1 flex flex-col">
                {selectedClientId ? (
                  /* Show file explorer as Overview tab content */
                  <div className="flex-1 overflow-hidden">
                    <div className="h-full">
                      {/* File panel content will be shown here */}
                      <div className="flex-1 flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            📁 Overview
                          </h3>
                          <p className="text-gray-600">
                            Browse files and folders in the left panel, or click a document to open it in a new tab.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Welcome message when no client is selected */
                  <div className="flex-1 flex items-center justify-center bg-white">
                    <div className="text-center">
                      <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        Welcome to Legal Document Manager
                      </h2>
                      <p className="text-gray-500 text-lg">
                        Select a client from the sidebar to view their files and folders
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Fixed Position */}
        <div className={`fixed right-16 top-12 bottom-0 z-10 transition-transform duration-300 ease-in-out ${
          rightPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <RightPanel
            isOpen={rightPanelOpen}
            mode={rightPanelMode}
            selectedClient={selectedClient || null}
            onClose={handleCloseRightPanel}
            onClientUpdated={handleClientUpdated}
            onOpenDocumentWithHighlights={handleDocumentOpen}
          />
        </div>

        {/* Right Icon Bar - Fixed Position */}
        <div className="fixed right-0 top-12 bottom-0 w-16 bg-gray-100 border-l border-gray-200 z-20">
          {/* Placeholder for right icon bar */}
        </div>
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
