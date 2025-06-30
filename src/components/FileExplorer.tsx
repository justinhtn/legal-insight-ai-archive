
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClients, getFolders, Client, Folder } from '@/services/clientService';
import { getDocuments } from '@/services/documentService';
import ClientSidebar from './explorer/ClientSidebar';
import FilePanel from './explorer/FilePanel';
import TabbedDocumentViewer from './explorer/TabbedDocumentViewer';
import GmailStyleChat from './explorer/GmailStyleChat';
import DocumentUploadModal from './DocumentUploadModal';
import { toast } from 'sonner';
import { FileText, Lightbulb, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Document {
  id: string;
  name: string;
  size: number;
  uploaded_at: string;
}

interface DocumentTabData {
  id: string;
  name: string;
  type: 'document' | 'folder';
  title: string;
  content: string;
  highlights: { text: string; page?: number; lines?: string; }[];
  query: string;
}

const FileExplorer: React.FC = () => {
  const [selectedClientId, setSelectedClientId] = useState<string>();
  const [selectedFolderId, setSelectedFolderId] = useState<string>();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [openTabs, setOpenTabs] = useState<DocumentTabData[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(true);

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  // Fetch folders for selected client
  const { data: folders = [], isLoading: foldersLoading, refetch: refetchFolders } = useQuery({
    queryKey: ['folders', selectedClientId],
    queryFn: () => selectedClientId ? getFolders(selectedClientId) : Promise.resolve([]),
    enabled: !!selectedClientId,
  });

  // Fetch documents for selected folder
  const { data: documents = [], isLoading: documentsLoading, refetch: refetchDocuments } = useQuery({
    queryKey: ['documents', selectedFolderId],
    queryFn: () => selectedFolderId ? getDocuments(selectedFolderId) : Promise.resolve([]),
    enabled: !!selectedFolderId,
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedFolderId(undefined);
  };

  const handleFolderClick = (folderId: string) => {
    setSelectedFolderId(folderId);
  };

  const handleNavigateToRoot = () => {
    setSelectedFolderId(undefined);
  };

  const handleFileClick = (file: any) => {
    if (file.type === 'document' || file.type === 'file') {
      const newTab: DocumentTabData = { 
        id: file.id, 
        name: file.name, 
        type: 'document',
        title: file.name,
        content: '',
        highlights: [],
        query: ''
      };
      setOpenTabs(prev => {
        const existingIndex = prev.findIndex(tab => tab.id === file.id);
        if (existingIndex >= 0) {
          setActiveTabId(file.id);
          setShowOverview(false);
          return prev;
        }
        const newTabs = [...prev, newTab];
        setActiveTabId(file.id);
        setShowOverview(false);
        return newTabs;
      });
    }
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

  const handleCloseTab = (tabId: string) => {
    setOpenTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          setActiveTabId(newTabs[newTabs.length - 1].id);
        } else {
          setActiveTabId(null);
          setShowOverview(true);
        }
      }
      return newTabs;
    });
  };

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
    setShowOverview(false);
  };

  const handleShowOverview = () => {
    setShowOverview(true);
    setActiveTabId(null);
  };

  const handleDocumentOpen = (document: any, highlights: any[], query: string) => {
    console.log('FileExplorer: Opening document with highlights', { document, highlights, query });
    
    const newTab: DocumentTabData = {
      id: document.document_file_name || document.id,
      name: document.document_title || document.name,
      type: 'document',
      title: document.document_title || document.name,
      content: '',
      highlights: highlights,
      query: query
    };
    
    setOpenTabs(prev => {
      const existingIndex = prev.findIndex(tab => tab.id === newTab.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newTab;
        setActiveTabId(newTab.id);
        setShowOverview(false);
        return updated;
      }
      const newTabs = [...prev, newTab];
      setActiveTabId(newTab.id);
      setShowOverview(false);
      return newTabs;
    });
  };

  const fileItems = documents.map(doc => ({
    id: doc.id,
    name: doc.name,
    type: 'file' as const,
    size: doc.size || 0,
    modified: doc.uploaded_at,
  }));

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex-1 flex overflow-hidden">
        {/* Client Sidebar */}
        <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200">
          <ClientSidebar
            clients={clients}
            selectedClientId={selectedClientId}
            onClientSelect={handleClientSelect}
            onNewClient={handleNewClient}
            isLoading={clientsLoading}
          />
        </div>

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-white transition-all duration-300 ${
          isChatOpen ? 'mr-80' : ''
        }`}>
          {selectedClientId ? (
            <>
              {/* Document Tabs Bar */}
              {openTabs.length > 0 && (
                <div className="document-tabs">
                  {/* Overview Tab */}
                  <div
                    onClick={handleShowOverview}
                    className={`document-tab ${showOverview ? 'active overview-tab' : ''}`}
                  >
                    <span className="tab-title">Overview</span>
                  </div>

                  {/* Document Tabs */}
                  {openTabs.map((tab) => (
                    <div
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`document-tab ${activeTabId === tab.id ? 'active' : ''}`}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="tab-title">{tab.title}</span>
                      {tab.highlights.length > 0 && (
                        <Lightbulb className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab.id);
                        }}
                        className="close-button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Content Area */}
              <div className="flex-1 flex overflow-hidden">
                {/* File Panel */}
                <div className="flex-1">
                  <FilePanel
                    files={fileItems}
                    folders={folders}
                    selectedFolderId={selectedFolderId}
                    folderName={selectedFolder?.name}
                    onUpload={handleUpload}
                    isLoading={foldersLoading || documentsLoading}
                    onRefresh={handleRefresh}
                    onFileClick={handleFileClick}
                    onFolderClick={handleFolderClick}
                    onNavigateToRoot={handleNavigateToRoot}
                    allFolders={folders}
                  />
                </div>

                {/* Document Viewer */}
                {openTabs.length > 0 && !showOverview && activeTabId && (
                  <div className="w-1/2 border-l border-gray-200 bg-white">
                    <TabbedDocumentViewer
                      tabs={openTabs}
                      activeTabId={activeTabId}
                      onTabChange={handleTabChange}
                      onTabClose={handleCloseTab}
                      onShowOverview={handleShowOverview}
                      showOverview={showOverview}
                      showTabsOnly={false}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
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

        {/* Chat Toggle Button - Fixed position when closed */}
        {selectedClientId && !isChatOpen && (
          <div className="absolute top-20 right-4 z-10">
            <Button
              onClick={() => setIsChatOpen(true)}
              variant="default"
              size="icon"
              className="w-12 h-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </div>
        )}

        {/* Chat Panel - Fixed width panel on the right */}
        {selectedClientId && isChatOpen && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white">
            <GmailStyleChat
              client={selectedClient || null}
              isOpen={isChatOpen}
              onOpenDocumentWithHighlights={handleDocumentOpen}
              onToggle={() => setIsChatOpen(false)}
              openTabs={openTabs}
              onSwitchToTab={handleTabChange}
            />
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

export default FileExplorer;
