import React, { useState, useEffect } from 'react';
import { Client, getClients, createClient, createFolder } from '@/services/clientService';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import ClientSidebar from './explorer/ClientSidebar';
import ClientContentPanel from './explorer/ClientContentPanel';
import GmailStyleChat from './explorer/GmailStyleChat';
import TabbedDocumentViewer from './explorer/TabbedDocumentViewer';

interface DocumentTabData {
  id: string;
  title: string;
  content: string;
  highlights: Array<{
    text: string;
    page?: number;
    lines?: string;
  }>;
  query: string;
}

interface FileExplorerProps {
  onUpload: () => void;
  onNavigateToSearch: () => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onUpload, onNavigateToSearch }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    case_number: '',
    matter_type: ''
  });

  // Chat panel state - persistent per client
  const [chatStates, setChatStates] = useState<Record<string, { isOpen: boolean; messages: any[] }>>({});

  // Document tabs state
  const [documentTabs, setDocumentTabs] = useState<DocumentTabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoadingClients(true);
    try {
      const clientsData = await getClients();
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
    } finally {
      setIsLoadingClients(false);
    }
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
      setSelectedFolderId(null);
      // Reset document tabs when switching clients
      setDocumentTabs([]);
      setActiveTabId(null);
      setShowOverview(true);
      
      // Initialize chat state for client if it doesn't exist
      if (!chatStates[clientId]) {
        setChatStates(prev => ({
          ...prev,
          [clientId]: { isOpen: false, messages: [] }
        }));
      }
    }
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
  };

  const handleToggleChat = () => {
    if (!selectedClient) return;
    
    setChatStates(prev => ({
      ...prev,
      [selectedClient.id]: {
        ...prev[selectedClient.id],
        isOpen: !prev[selectedClient.id]?.isOpen
      }
    }));
  };

  const getCurrentChatState = () => {
    if (!selectedClient) return { isOpen: false, messages: [] };
    return chatStates[selectedClient.id] || { isOpen: false, messages: [] };
  };

  // Handle opening documents with highlights in tabs
  const handleOpenDocumentWithHighlights = async (document: any, highlights: any[], query: string) => {
    try {
      console.log('Opening document with highlights:', { document, highlights, query });
      
      // Load full document content
      const { data: fullDoc, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', document.id || document.document_id)
        .single();

      if (error) throw error;

      const tabId = `doc-${fullDoc.id}-${Date.now()}`;
      const newTab: DocumentTabData = {
        id: tabId,
        title: fullDoc.file_name,
        content: fullDoc.content || 'Document content will be loaded here',
        highlights: highlights.map(h => ({
          text: h.text,
          page: h.page,
          lines: h.lines
        })),
        query
      };

      setDocumentTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
      setShowOverview(false);
      
      toast({
        title: "Document Opened",
        description: `Opened ${fullDoc.file_name} with ${highlights.length} highlights`,
      });
    } catch (error) {
      console.error('Error loading document:', error);
      toast({
        title: "Error",
        description: "Failed to load document",
        variant: "destructive",
      });
    }
  };

  const handleOpenDocument = async (document: any) => {
    try {
      // Load the full document content from database
      const { data: fullDoc, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', document.id)
        .single();

      if (error) throw error;

      const tabId = `doc-${fullDoc.id}-${Date.now()}`;
      const newTab: DocumentTabData = {
        id: tabId,
        title: fullDoc.file_name,
        content: fullDoc.content || 'Document content will be loaded here',
        highlights: [],
        query: ''
      };

      setDocumentTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
      setShowOverview(false);
      
      toast({
        title: "Document Opened",
        description: `Opened ${fullDoc.file_name}`,
      });
    } catch (error) {
      console.error('Error loading document:', error);
      toast({
        title: "Error",
        description: "Failed to load document",
        variant: "destructive",
      });
    }
  };

  const handleTabClose = (tabId: string) => {
    setDocumentTabs(prev => prev.filter(tab => tab.id !== tabId));
    if (activeTabId === tabId) {
      const remainingTabs = documentTabs.filter(tab => tab.id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
      } else {
        setActiveTabId(null);
        setShowOverview(true);
      }
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
    setShowOverview(false);
  };

  const handleShowOverview = () => {
    setShowOverview(true);
    setActiveTabId(null);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !selectedClient) {
      toast({
        title: "Error",
        description: "Please enter a folder name and select a client",
        variant: "destructive",
      });
      return;
    }

    try {
      await createFolder({
        client_id: selectedClient.id,
        parent_folder_id: null,
        name: newFolderName.trim()
      });

      setNewFolderName('');
      setShowNewFolderDialog(false);
      
      toast({
        title: "Success",
        description: "Folder created successfully",
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create folder",
        variant: "destructive",
      });
    }
  };

  const handleCreateClient = async () => {
    if (!newClientData.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a client name",
        variant: "destructive",
      });
      return;
    }

    try {
      const newClient = await createClient(newClientData);
      setClients(prev => [...prev, newClient]);
      setSelectedClient(newClient);
      setSelectedFolderId(null);
      
      setNewClientData({
        name: '',
        email: '',
        phone: '',
        case_number: '',
        matter_type: ''
      });
      setShowNewClientDialog(false);
      
      toast({
        title: "Success",
        description: "Client created successfully",
      });
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: "Error",
        description: "Failed to create client",
        variant: "destructive",
      });
    }
  };

  const handleUploadWithContext = () => {
    onUpload();
  };

  const handleClientUpdated = (updatedClient: Client) => {
    setSelectedClient(updatedClient);
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
  };

  const currentChatState = getCurrentChatState();

  return (
    <div className="h-screen bg-gray-50 p-4 overflow-hidden">
      {/* Gmail-style responsive layout */}
      <div className="flex h-full gap-4 relative">
        
        {/* Client List - Fixed width (15%) */}
        <div className="w-1/6 flex-shrink-0 h-full overflow-hidden">
          <ClientSidebar
            clients={clients}
            selectedClientId={selectedClient?.id}
            onClientSelect={handleClientSelect}
            onNewClient={() => setShowNewClientDialog(true)}
            isLoading={isLoadingClients}
          />
        </div>

        {/* Main Content - Responsive width based on chat state */}
        <div className={`bg-white rounded-lg shadow-sm border flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300 ${
          currentChatState.isOpen ? 'flex-1 mr-96' : 'flex-1'
        }`}>
          {selectedClient ? (
            <>
              {/* Tab Bar */}
              <TabbedDocumentViewer
                tabs={documentTabs}
                activeTabId={activeTabId}
                onTabChange={handleTabChange}
                onTabClose={handleTabClose}
                onShowOverview={handleShowOverview}
                showOverview={showOverview}
                showTabsOnly={true}
              />
              
              {/* Content Area */}
              <div className="flex-1 overflow-hidden">
                {showOverview || !activeTabId ? (
                  <ClientContentPanel
                    client={selectedClient}
                    selectedFolderId={selectedFolderId}
                    onFolderSelect={handleFolderSelect}
                    onNewFolder={() => setShowNewFolderDialog(true)}
                    onUpload={handleUploadWithContext}
                    onClientUpdated={handleClientUpdated}
                    onOpenDocument={handleOpenDocument}
                    isChatOpen={currentChatState.isOpen}
                    onToggleChat={handleToggleChat}
                    onOpenDocumentWithHighlights={handleOpenDocumentWithHighlights}
                  />
                ) : (
                  <TabbedDocumentViewer
                    tabs={documentTabs}
                    activeTabId={activeTabId}
                    onTabChange={handleTabChange}
                    onTabClose={handleTabClose}
                    onShowOverview={handleShowOverview}
                    showOverview={showOverview}
                    showTabsOnly={false}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Welcome to Your Legal Archive
                </h2>
                <p className="text-gray-600 mb-6">
                  Select a client from the sidebar to view their documents and folders
                </p>
                {clients.length === 0 && !isLoadingClients && (
                  <Button onClick={() => setShowNewClientDialog(true)}>
                    Create Your First Client
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chat Panel - Fixed position, slides in from right */}
        {selectedClient && (
          <div className={`fixed right-4 top-4 bottom-4 w-96 bg-white rounded-lg shadow-lg border transform transition-transform duration-300 z-50 ${
            currentChatState.isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <GmailStyleChat
              client={selectedClient}
              isOpen={currentChatState.isOpen}
              onOpenDocumentWithHighlights={handleOpenDocumentWithHighlights}
              onToggle={handleToggleChat}
            />
          </div>
        )}
      </div>

      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                value={newClientData.name}
                onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                placeholder="Enter client name"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clientEmail">Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <Label htmlFor="clientPhone">Phone</Label>
                <Input
                  id="clientPhone"
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="caseNumber">Case Number</Label>
                <Input
                  id="caseNumber"
                  value={newClientData.case_number}
                  onChange={(e) => setNewClientData({ ...newClientData, case_number: e.target.value })}
                  placeholder="2024-CV-1234"
                />
              </div>
              <div>
                <Label htmlFor="matterType">Matter Type</Label>
                <Input
                  id="matterType"
                  value={newClientData.matter_type}
                  onChange={(e) => setNewClientData({ ...newClientData, matter_type: e.target.value })}
                  placeholder="Contract, Divorce, etc."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowNewClientDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateClient}>Create Client</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileExplorer;
