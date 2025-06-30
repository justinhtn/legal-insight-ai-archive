import React, { useState, useEffect } from 'react';
import { Client, getClients, createClient, createFolder } from '@/services/clientService';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MessageCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ClientSidebar from './explorer/ClientSidebar';
import ClientContentPanel from './explorer/ClientContentPanel';
import GmailStyleChat from './explorer/GmailStyleChat';
import TabbedDocumentViewer from './explorer/TabbedDocumentViewer';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: any[];
  documentCount?: number;
  query?: string;
}

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
  document_id?: string;
  document_title?: string;
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

  // Chat panel state - persistent per client with message storage
  const [chatStates, setChatStates] = useState<Record<string, { 
    isOpen: boolean; 
    messages: ChatMessage[] 
  }>>({});

  // Document tabs state
  const [documentTabs, setDocumentTabs] = useState<DocumentTabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    loadClients();
    loadChatStates();
  }, []);

  // Load chat states from localStorage
  const loadChatStates = () => {
    try {
      const savedChatStates = localStorage.getItem('chatStates');
      if (savedChatStates) {
        const parsed = JSON.parse(savedChatStates);
        // Convert timestamp strings back to Date objects
        const restoredStates: Record<string, { isOpen: boolean; messages: ChatMessage[] }> = {};
        
        Object.keys(parsed).forEach(clientId => {
          restoredStates[clientId] = {
            isOpen: false, // Always start with chat closed
            messages: parsed[clientId].messages?.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })) || []
          };
        });
        
        setChatStates(restoredStates);
      }
    } catch (error) {
      console.error('Error loading chat states:', error);
    }
  };

  // Save chat states to localStorage
  const saveChatStates = (states: Record<string, { isOpen: boolean; messages: ChatMessage[] }>) => {
    try {
      localStorage.setItem('chatStates', JSON.stringify(states));
    } catch (error) {
      console.error('Error saving chat states:', error);
    }
  };

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
        setChatStates(prev => {
          const newStates = {
            ...prev,
            [clientId]: { isOpen: false, messages: [] }
          };
          saveChatStates(newStates);
          return newStates;
        });
      }
    }
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
  };

  const handleToggleChat = () => {
    if (!selectedClient) return;
    
    setChatStates(prev => {
      const newStates = {
        ...prev,
        [selectedClient.id]: {
          ...prev[selectedClient.id],
          isOpen: !prev[selectedClient.id]?.isOpen
        }
      };
      saveChatStates(newStates);
      return newStates;
    });
  };

  const handleChatMessagesChange = (messages: ChatMessage[]) => {
    if (!selectedClient) return;
    
    setChatStates(prev => {
      const newStates = {
        ...prev,
        [selectedClient.id]: {
          ...prev[selectedClient.id],
          messages
        }
      };
      saveChatStates(newStates);
      return newStates;
    });
  };

  const getCurrentChatState = () => {
    if (!selectedClient) return { isOpen: false, messages: [] };
    return chatStates[selectedClient.id] || { isOpen: false, messages: [] };
  };

  // Smart tab management - check for existing tabs before creating new ones
  const handleOpenDocumentWithHighlights = async (document: any, highlights: any[], query: string) => {
    try {
      console.log('Opening document with highlights:', { document, highlights, query });
      
      // Check if document is already open in a tab
      const existingTab = documentTabs.find(tab => 
        tab.document_id === (document.id || document.document_id) ||
        tab.document_title === document.document_title ||
        tab.title === document.document_title
      );
      
      if (existingTab) {
        console.log('Document already open, switching to existing tab:', existingTab);
        // Update existing tab with new highlights and switch to it
        setDocumentTabs(prev => prev.map(tab => 
          tab.id === existingTab.id 
            ? { ...tab, highlights: highlights.map(h => ({ text: h.text, page: h.page, lines: h.lines })), query }
            : tab
        ));
        setActiveTabId(existingTab.id);
        setShowOverview(false);
        
        toast({
          title: "Switched to existing tab",
          description: `Updated ${existingTab.title} with ${highlights.length} highlights`,
        });
        return;
      }
      
      // Load full document content for new tab
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
        query,
        document_id: fullDoc.id,
        document_title: fullDoc.file_name
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

  // Function to switch to an existing tab
  const handleSwitchToTab = (tabId: string) => {
    setActiveTabId(tabId);
    setShowOverview(false);
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
        query: '',
        document_id: fullDoc.id,
        document_title: fullDoc.file_name
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

        {/* Gmail-style Fixed Chat Toggle - Always visible on right edge */}
        {selectedClient && (
          <div className="fixed right-0 top-1/2 transform -translate-y-1/2 z-40">
            <Button
              onClick={handleToggleChat}
              variant={currentChatState.isOpen ? "default" : "outline"}
              size="sm"
              className={`h-12 px-3 rounded-l-lg rounded-r-none shadow-lg border-r-0 transition-all duration-300 ${
                currentChatState.isOpen 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Chat Panel - Fixed position, slides in from right */}
        {selectedClient && (
          <div className={`fixed right-4 top-4 bottom-4 w-96 bg-white rounded-lg shadow-lg border transform transition-transform duration-300 z-50 ${
            currentChatState.isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            {/* Chat panel close button */}
            <div className="absolute top-2 right-2 z-10">
              <Button
                onClick={handleToggleChat}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <GmailStyleChat
              client={selectedClient}
              isOpen={currentChatState.isOpen}
              onOpenDocumentWithHighlights={handleOpenDocumentWithHighlights}
              onToggle={handleToggleChat}
              messages={currentChatState.messages}
              onMessagesChange={handleChatMessagesChange}
              openTabs={documentTabs}
              onSwitchToTab={handleSwitchToTab}
            />
          </div>
        )}
      </div>

      {/* Dialog components - keep existing code */}
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
