
import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import DocumentTabManager from './DocumentTabManager';
import ClientExplorer from './ClientExplorer';
import TabbedDocumentViewer from './TabbedDocumentViewer';
import ChatIntegration from './ChatIntegration';
import DocumentUploadModal from '../DocumentUploadModal';
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';
import { useChatIntegration } from '@/hooks/useChatIntegration';
import { useQuery } from '@tanstack/react-query';
import { getClients, getFolders } from '@/services/clientService';
import { getDocuments } from '@/services/documentService';
import { toast } from 'sonner';

const FileExplorerLayout: React.FC = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { selectedClientId, selectedFolderId } = useFileExplorer();
  const { openTabs, activeTabId, showOverview } = useDocumentTabs();
  const { isChatOpen } = useChatIntegration();

  // Get selected client data
  const { data: clients = [] } = useQuery({
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
      {/* Document Tabs - Always visible when there are open tabs */}
      {openTabs.length > 0 && <DocumentTabManager />}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Always show the client explorer */}
        <ClientExplorer
          onUpload={handleUpload}
          onRefresh={handleRefresh}
          onNewClient={handleNewClient}
        />

        {/* Document Viewer - Only show when there are open tabs and not showing overview */}
        {openTabs.length > 0 && !showOverview && activeTabId && (
          <div className="w-1/2 border-l border-gray-200 bg-white">
            <TabbedDocumentViewer
              tabs={openTabs}
              activeTabId={activeTabId}
              onTabChange={() => {}} // Handled by context
              onTabClose={() => {}} // Handled by context
              onShowOverview={() => {}} // Handled by context
              showOverview={showOverview}
              showTabsOnly={false}
            />
          </div>
        )}

        {/* Welcome message when no client is selected */}
        {!selectedClientId && (
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

        {/* Chat Panel - True flex panel that pushes content */}
        {isChatOpen && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white">
            <ChatIntegration selectedClient={selectedClient || null} />
          </div>
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
