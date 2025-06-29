
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Folder as FolderType, getClients, getFolders, createFolder, createClient } from '@/services/clientService';
import { useToast } from '@/hooks/use-toast';
import FinderHeader from './finder/FinderHeader';
import ClientInfoPanel from './finder/ClientInfoPanel';
import FileListView from './finder/FileListView';
import FileIconView from './finder/FileIconView';
import SidebarPanel from './finder/SidebarPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface NavigationPath {
  id: string;
  name: string;
  type: 'root' | 'client' | 'folder';
}

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  modified: string;
  client_name?: string;
}

interface FileExplorerProps {
  onUpload: () => void;
  onNavigateToSearch: () => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onUpload, onNavigateToSearch }) => {
  const [currentPath, setCurrentPath] = useState<NavigationPath[]>([
    { id: 'root', name: 'Manage', type: 'root' }
  ]);
  const [pathHistory, setPathHistory] = useState<NavigationPath[][]>([
    [{ id: 'root', name: 'Manage', type: 'root' }]
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [items, setItems] = useState<FileItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'icon' | 'column'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [sidebarFolders, setSidebarFolders] = useState<FolderType[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
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
  const { toast } = useToast();

  const currentLocation = currentPath[currentPath.length - 1];
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < pathHistory.length - 1;
  const isInClient = currentLocation.type === 'client' || currentLocation.type === 'folder';

  useEffect(() => {
    loadCurrentItems();
  }, [currentPath, selectedFolderId]);

  useEffect(() => {
    if (currentLocation.type === 'client') {
      loadClientAndFolders(currentLocation.id);
    } else {
      setCurrentClient(null);
      setSidebarFolders([]);
      setSelectedFolderId('');
    }
  }, [currentLocation]);

  const loadClientAndFolders = async (clientId: string) => {
    try {
      const clients = await getClients();
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setCurrentClient(client);
        const folders = await getFolders(clientId);
        setSidebarFolders(folders);
        if (folders.length > 0 && !selectedFolderId) {
          setSelectedFolderId(folders[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading client and folders:', error);
    }
  };

  const loadCurrentItems = async () => {
    setIsLoading(true);
    try {
      if (currentLocation.type === 'root') {
        const clients = await getClients();
        const clientItems: FileItem[] = clients.map(client => ({
          id: client.id,
          name: client.name,
          type: 'folder' as const,
          modified: client.updated_at
        }));
        setItems(clientItems);
      } else if (currentLocation.type === 'client') {
        if (selectedFolderId) {
          const documents = await getDocumentsByFolder(selectedFolderId);
          const documentItems: FileItem[] = documents.map(doc => ({
            id: doc.id,
            name: doc.file_name,
            type: 'file' as const,
            size: doc.file_size,
            modified: doc.updated_at
          }));
          setItems(documentItems);
        } else {
          setItems([]);
        }
      }
    } catch (error) {
      console.error('Error loading items:', error);
      toast({
        title: "Error",
        description: "Failed to load folder contents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDocumentsByFolder = async (folderId: string) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('folder_id', folderId);

    if (error) throw error;
    return data || [];
  };

  const navigateTo = (newPath: NavigationPath[]) => {
    const newHistory = pathHistory.slice(0, historyIndex + 1);
    newHistory.push(newPath);
    setPathHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPath(newPath);
    setSelectedItems([]);
  };

  const handleBack = () => {
    if (canGoBack) {
      setHistoryIndex(historyIndex - 1);
      setCurrentPath(pathHistory[historyIndex - 1]);
      setSelectedItems([]);
    }
  };

  const handleForward = () => {
    if (canGoForward) {
      setHistoryIndex(historyIndex + 1);
      setCurrentPath(pathHistory[historyIndex + 1]);
      setSelectedItems([]);
    }
  };

  const handleItemClick = (item: FileItem) => {
    if (selectedItems.includes(item.id)) {
      setSelectedItems(selectedItems.filter(id => id !== item.id));
    } else {
      setSelectedItems([item.id]);
    }
  };

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.type === 'folder' && currentLocation.type === 'root') {
      const newPath = [...currentPath, {
        id: item.id,
        name: item.name,
        type: 'client' as const
      }];
      navigateTo(newPath);
    }
  };

  const handleSidebarFolderClick = (folderId: string) => {
    setSelectedFolderId(folderId);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentClient) return;

    try {
      await createFolder({
        client_id: currentClient.id,
        parent_folder_id: selectedFolderId || undefined,
        name: newFolderName.trim()
      });

      setNewFolderName('');
      setShowNewFolderDialog(false);
      
      // Refresh folders and current items
      await loadClientAndFolders(currentClient.id);
      await loadCurrentItems();
      
      toast({
        title: "Success",
        description: "Folder created successfully",
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
    }
  };

  const handleCreateClient = async () => {
    if (!newClientData.name.trim()) return;

    try {
      await createClient(newClientData);
      setNewClientData({
        name: '',
        email: '',
        phone: '',
        case_number: '',
        matter_type: ''
      });
      setShowNewClientDialog(false);
      
      // Refresh the items list
      await loadCurrentItems();
      
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

  const handleUpload = () => {
    if (currentClient && selectedFolderId) {
      onUpload();
    } else {
      toast({
        title: "Select a folder",
        description: "Please select a folder to upload documents to",
        variant: "destructive",
      });
    }
  };

  const renderMainContent = () => {
    if (currentLocation.type === 'root') {
      return (
        <div className="flex-1 flex flex-col">
          {viewMode === 'list' ? (
            <FileListView
              items={items}
              selectedItems={selectedItems}
              onItemClick={handleItemClick}
              onItemDoubleClick={handleItemDoubleClick}
            />
          ) : (
            <FileIconView
              items={items}
              selectedItems={selectedItems}
              onItemClick={handleItemClick}
              onItemDoubleClick={handleItemDoubleClick}
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 flex">
        <SidebarPanel
          clientName={currentClient?.name || ''}
          folders={sidebarFolders.map(f => ({ id: f.id, name: f.name, type: 'folder' as const }))}
          selectedFolderId={selectedFolderId}
          onFolderClick={handleSidebarFolderClick}
          onNewFolder={() => setShowNewFolderDialog(true)}
        />
        <div className="flex-1 flex flex-col">
          {currentClient && (
            <div className="p-4">
              <ClientInfoPanel
                client={currentClient}
                onClientUpdated={setCurrentClient}
              />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            {viewMode === 'list' ? (
              <FileListView
                items={items}
                selectedItems={selectedItems}
                onItemClick={handleItemClick}
                onItemDoubleClick={handleItemDoubleClick}
              />
            ) : (
              <FileIconView
                items={items}
                selectedItems={selectedItems}
                onItemClick={handleItemClick}
                onItemDoubleClick={handleItemDoubleClick}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <FinderHeader
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={handleBack}
        onForward={handleForward}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewFolder={currentLocation.type === 'root' ? 
          () => setShowNewClientDialog(true) : 
          () => setShowNewFolderDialog(true)
        }
        onUpload={handleUpload}
        currentPath={currentPath.map(p => p.name)}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (
        renderMainContent()
      )}

      {/* New Folder Dialog */}
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

      {/* New Client Dialog */}
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
