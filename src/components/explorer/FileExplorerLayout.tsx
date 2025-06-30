
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClients, getFolders, Client } from '@/services/clientService';
import { getDocuments } from '@/services/documentService';
import VSCodeExplorer from './VSCodeExplorer';
import DocumentTabSystem from './DocumentTabSystem';
import DocumentViewer from './DocumentViewer';
import ExplorerHeader from './ExplorerHeader';
import RightPanel from './RightPanel';
import DocumentUploadModal from '../DocumentUploadModal';
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { toast } from 'sonner';

interface DocumentTab {
  id: string;
  name: string;
  icon: string;
  fileName?: string;
  clientId?: string;
  content?: string;
  isActive: boolean;
}

const FileExplorerLayout: React.FC = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'chat' | 'client-info' | null>(null);
  const [openTabs, setOpenTabs] = useState<DocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  
  const { selectedClientId, selectedFolderId, setSelectedClientId, setSelectedFolderId } = useFileExplorer();

  // Get client data
  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  const { data: folders = [], refetch: refetchFolders } = useQuery({
    queryKey: ['folders', selectedClientId],
    queryFn: () => selectedClientId ? getFolders(selectedClientId) : Promise.resolve([]),
    enabled: !!selectedClientId,
  });

  const { data: documents = [], refetch: refetchDocuments } = useQuery({
    queryKey: ['documents', selectedFolderId],
    queryFn: () => selectedFolderId ? getDocuments(selectedFolderId) : Promise.resolve([]),
    enabled: !!selectedFolderId,
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Tab management
  const handleFileClick = (file: any) => {
    const existingTab = openTabs.find(tab => tab.id === file.id);
    
    if (existingTab) {
      setActiveTabId(file.id);
    } else {
      const newTab: DocumentTab = {
        id: file.id,
        name: file.name,
        icon: '📄',
        fileName: file.name,
        clientId: selectedClientId,
        isActive: true
      };
      
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabId(file.id);
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleTabClose = (tabId: string) => {
    setOpenTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      
      // If closing active tab, switch to another tab
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          setActiveTabId(newTabs[newTabs.length - 1].id);
        } else {
          setActiveTabId(null);
        }
      }
      
      return newTabs;
    });
  };

  // Panel management
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

  const handleDocumentOpen = async (document: any, highlights: any[], query: string) => {
    handleFileClick(document);
  };

  const activeTab = openTabs.find(tab => tab.id === activeTabId);

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

      {/* Main Layout */}
      <div className="flex flex-1 pt-12">
        {/* VS Code Explorer */}
        <VSCodeExplorer
          clients={clients}
          folders={folders}
          selectedClientId={selectedClientId}
          selectedFolderId={selectedFolderId}
          onClientSelect={setSelectedClientId}
          onFolderClick={setSelectedFolderId}
          onFileClick={handleFileClick}
          onNewClient={handleNewClient}
          isLoading={false}
        />

        {/* Main Content */}
        <div className={`main-content ${rightPanelOpen ? 'chat-open' : ''}`}>
          {/* Document Tabs */}
          <DocumentTabSystem
            tabs={openTabs}
            activeTabId={activeTabId}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
          />

          {/* Document Area */}
          {activeTab ? (
            <DocumentViewer
              documentId={activeTab.id}
              fileName={activeTab.fileName}
              content={activeTab.content}
            />
          ) : (
            <div className="welcome-state">
              <div className="welcome-content">
                <div className="welcome-icon">📁</div>
                <div className="welcome-title">Welcome to Legal Explorer</div>
                <div className="welcome-subtitle">
                  Select a client and open a document to get started
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
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

        {/* Right Icon Bar */}
        <div className="right-icon-bar">
          {/* Icon bar content can be added here */}
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
