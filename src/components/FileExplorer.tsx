
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClients, getFolders, Client, Folder } from '@/services/clientService';
import { getDocuments } from '@/services/documentService';
import ClientSidebar from './explorer/ClientSidebar';
import FilePanel from './explorer/FilePanel';
import ClientContentPanel from './explorer/ClientContentPanel';
import TabbedDocumentViewer from './explorer/TabbedDocumentViewer';
import FloatingChatPanel from './explorer/FloatingChatPanel';
import DocumentUploadModal from './DocumentUploadModal';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Files, MessageSquare, Settings } from 'lucide-react';

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
  highlights: string[];
  query: string;
}

const FileExplorer: React.FC = () => {
  const [selectedClientId, setSelectedClientId] = useState<string>();
  const [selectedFolderId, setSelectedFolderId] = useState<string>();
  const [activeTab, setActiveTab] = useState<'files' | 'chat' | 'settings'>('files');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [openTabs, setOpenTabs] = useState<DocumentTabData[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

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
    setActiveTab('files');
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
          return prev;
        }
        return [...prev, newTab];
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
    setOpenTabs(prev => prev.filter(tab => tab.id !== tabId));
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
      {/* Main Layout */}
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
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {selectedClientId ? (
            <>
              {/* Browser-like Tabs */}
              <div className="bg-white border-b border-gray-200">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
                  <TabsList className="h-12 bg-white rounded-none w-full justify-start border-0 p-0">
                    <TabsTrigger 
                      value="files" 
                      className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 hover:bg-gray-50 transition-colors"
                    >
                      <Files className="h-4 w-4" />
                      Files
                    </TabsTrigger>
                    <TabsTrigger 
                      value="chat" 
                      className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 hover:bg-gray-50 transition-colors"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Chat
                    </TabsTrigger>
                    <TabsTrigger 
                      value="settings" 
                      className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="files" className="flex-1 overflow-hidden mt-0">
                    <div className="flex h-full">
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
                      {openTabs.length > 0 && (
                        <div className="w-1/2 border-l border-gray-200 bg-white">
                          <TabbedDocumentViewer
                            tabs={openTabs}
                            onCloseTab={handleCloseTab}
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
                    <ClientContentPanel
                      client={selectedClient}
                      onFolderSelect={() => {}}
                      onNewFolder={() => {}}
                      onUpload={handleUpload}
                      onClientUpdated={() => {}}
                      folders={folders}
                      isLoading={false}
                    />
                  </TabsContent>

                  <TabsContent value="settings" className="flex-1 overflow-hidden mt-0">
                    <div className="flex items-center justify-center h-full bg-white">
                      <div className="text-center">
                        <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Client Settings</h3>
                        <p className="text-gray-500 text-sm">
                          Client settings panel coming soon
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center">
                <Files className="h-16 w-16 mx-auto text-gray-400 mb-4" />
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
