import React, { useState, useEffect } from 'react';
import { Client, getClients, createClient, createFolder } from '@/services/clientService';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { supabase } from '@/integrations/supabase/client';
import ClientSidebar from './explorer/ClientSidebar';
import ClientContentPanel from './explorer/ClientContentPanel';
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

  // Document tab management
  const [documentTabs, setDocumentTabs] = useState<DocumentTabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(true);

  // Chat panel state
  const [isChatOpen, setIsChatOpen] = useState(false);

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
      // Keep chat state persistent per client
    }
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
  };

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleOpenDocumentWithHighlights = (document: any, highlights: any[], query: string) => {
    // Load full document content
    const fullDocumentContent = `${document.document_title}

CONFIDENTIAL ATTORNEY-CLIENT PRIVILEGED

This is the full document content for ${document.document_title}. In a real implementation, this would contain the complete document text loaded from the database, not just excerpts.

The document would include:
- Complete text content with proper formatting
- All sections, paragraphs, and details
- Headers, footers, and metadata
- Full context around highlighted sections

${document.excerpts?.map((excerpt: any, index: number) => `
Section ${index + 1}:
${excerpt.text}
`).join('\n') || ''}

[Complete document content would continue here with all remaining text...]

This ensures users can read the full context around highlighted sections and understand the complete document structure and content.`;
    
    const tabId = `${document.document_file_name}-${Date.now()}`;
    
    const newTab: DocumentTabData = {
      id: tabId,
      title: document.document_title,
      content: fullDocumentContent,
      highlights: highlights,
      query: query
    };

    setDocumentTabs(prev => [...prev, newTab]);
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

      // Create full document content - in real implementation, this would be the actual document text
      const fullDocumentContent = `${fullDoc.file_name}

FULL DOCUMENT CONTENT

This is the complete document content for ${fullDoc.file_name}. 

Document Details:
- File Name: ${fullDoc.file_name}
- File Size: ${fullDoc.file_size} bytes
- Upload Date: ${new Date(fullDoc.created_at).toLocaleDateString()}
- Last Modified: ${new Date(fullDoc.updated_at).toLocaleDateString()}

${fullDoc.content || `Full document text would be loaded here. This would include:

1. Complete document structure
2. All paragraphs and sections
3. Headers, footers, and formatting
4. Tables, lists, and special content
5. Full text that users can scroll through

The document content would be parsed and displayed in its entirety,
allowing users to read the complete context and navigate through
all sections of the document.

This ensures lawyers have access to the full document when reviewing
cases and can see all details in their proper context.`}

[End of Document]`;
      
      const tabId = `${document.name}-${Date.now()}`;
      
      const newTab: DocumentTabData = {
        id: tabId,
        title: document.name,
        content: fullDocumentContent,
        highlights: [],
        query: ''
      };

      setDocumentTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
      setShowOverview(false);
    } catch (error) {
      console.error('Error loading document:', error);
      toast({
        title: "Error",
        description: "Failed to load document",
        variant: "destructive",
      });
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
    setShowOverview(false);
  };

  const handleTabClose = (tabId: string) => {
    setDocumentTabs(prev => prev.filter(tab => tab.id !== tabId));
    
    if (activeTabId === tabId) {
      const remainingTabs = documentTabs.filter(tab => tab.id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
      } else {
        setShowOverview(true);
        setActiveTabId(null);
      }
    }
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

  return (
    <div className="h-full flex bg-white relative">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Panel 1: Client Sidebar */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <ClientSidebar
            clients={clients}
            selectedClientId={selectedClient?.id}
            onClientSelect={handleClientSelect}
            onNewClient={() => setShowNewClientDialog(true)}
            isLoading={isLoadingClients}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Panel 2: Main Content Area */}
        <ResizablePanel defaultSize={isChatOpen ? 60 : 80} minSize={40}>
          {selectedClient ? (
            <div className="flex flex-col h-full">
              {/* Always show tabs when client is selected */}
              <div className="sticky top-0 z-10 bg-white border-b">
                <TabbedDocumentViewer
                  tabs={documentTabs}
                  activeTabId={activeTabId}
                  onTabChange={handleTabChange}
                  onTabClose={handleTabClose}
                  onShowOverview={handleShowOverview}
                  showOverview={showOverview}
                  showTabsOnly={true}
                />
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-hidden">
                {showOverview ? (
                  <ClientContentPanel
                    client={selectedClient}
                    selectedFolderId={selectedFolderId}
                    onFolderSelect={handleFolderSelect}
                    onNewFolder={() => setShowNewFolderDialog(true)}
                    onUpload={handleUploadWithContext}
                    onClientUpdated={handleClientUpdated}
                    onOpenDocument={handleOpenDocument}
                    isChatOpen={isChatOpen}
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
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
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
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Dialogs remain the same */}
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
