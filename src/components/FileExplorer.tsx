import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  Folder, 
  FileText, 
  Plus,
  MoreVertical,
  Upload
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Folder as FolderType, getClients, getFolders, createFolder } from '@/services/clientService';
import { getDocuments } from '@/services/documentService';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    { id: 'root', name: 'All Clients', type: 'root' }
  ]);
  const [items, setItems] = useState<FileItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const { toast } = useToast();

  const currentLocation = currentPath[currentPath.length - 1];
  const canGoBack = currentPath.length > 1;

  useEffect(() => {
    loadCurrentItems();
  }, [currentPath]);

  const loadCurrentItems = async () => {
    setIsLoading(true);
    try {
      if (currentLocation.type === 'root') {
        // Load all clients
        const clients = await getClients();
        const clientItems: FileItem[] = clients.map(client => ({
          id: client.id,
          name: client.name,
          type: 'folder' as const,
          modified: client.updated_at
        }));
        setItems(clientItems);
      } else if (currentLocation.type === 'client') {
        // Load folders and documents for this client
        const [folders, documents] = await Promise.all([
          getFolders(currentLocation.id),
          getDocumentsByClient(currentLocation.id)
        ]);

        const folderItems: FileItem[] = folders.map(folder => ({
          id: folder.id,
          name: folder.name,
          type: 'folder' as const,
          modified: folder.updated_at
        }));

        const documentItems: FileItem[] = documents.map(doc => ({
          id: doc.id,
          name: doc.file_name,
          type: 'file' as const,
          size: doc.file_size,
          modified: doc.updated_at
        }));

        setItems([...folderItems, ...documentItems]);
      } else if (currentLocation.type === 'folder') {
        // Load subfolders and documents for this folder
        const clientId = currentPath.find(p => p.type === 'client')?.id;
        if (clientId) {
          const [folders, documents] = await Promise.all([
            getFolders(clientId, currentLocation.id),
            getDocumentsByFolder(currentLocation.id)
          ]);

          const folderItems: FileItem[] = folders.map(folder => ({
            id: folder.id,
            name: folder.name,
            type: 'folder' as const,
            modified: folder.updated_at
          }));

          const documentItems: FileItem[] = documents.map(doc => ({
            id: doc.id,
            name: doc.file_name,
            type: 'file' as const,
            size: doc.file_size,
            modified: doc.updated_at
          }));

          setItems([...folderItems, ...documentItems]);
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

  const getDocumentsByClient = async (clientId: string) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)
      .is('folder_id', null);

    if (error) throw error;
    return data || [];
  };

  const getDocumentsByFolder = async (folderId: string) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('folder_id', folderId);

    if (error) throw error;
    return data || [];
  };

  const navigateInto = (item: FileItem) => {
    if (item.type === 'folder') {
      const newPathItem: NavigationPath = {
        id: item.id,
        name: item.name,
        type: currentLocation.type === 'root' ? 'client' : 'folder'
      };
      setCurrentPath([...currentPath, newPathItem]);
      setSelectedItems([]);
    }
  };

  const navigateBack = () => {
    if (canGoBack) {
      setCurrentPath(currentPath.slice(0, -1));
      setSelectedItems([]);
    }
  };

  const navigateTo = (index: number) => {
    if (index < currentPath.length - 1) {
      setCurrentPath(currentPath.slice(0, index + 1));
      setSelectedItems([]);
    }
  };

  const formatSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const clientId = currentPath.find(p => p.type === 'client')?.id;
      const parentFolderId = currentLocation.type === 'folder' ? currentLocation.id : undefined;

      if (!clientId) {
        toast({
          title: "Error",
          description: "Cannot create folder outside of a client",
          variant: "destructive",
        });
        return;
      }

      await createFolder({
        client_id: clientId,
        parent_folder_id: parentFolderId,
        name: newFolderName.trim()
      });

      setNewFolderName('');
      setShowNewFolderInput(false);
      loadCurrentItems();
      
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

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={navigateBack}
            disabled={!canGoBack}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Breadcrumb */}
          <div className="flex items-center space-x-1 text-sm">
            {currentPath.map((path, index) => (
              <React.Fragment key={path.id}>
                {index > 0 && <span className="text-gray-400">›</span>}
                <button
                  onClick={() => navigateTo(index)}
                  className={`hover:text-blue-600 ${
                    index === currentPath.length - 1 
                      ? 'font-semibold text-gray-900' 
                      : 'text-gray-600'
                  }`}
                >
                  {path.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewFolderInput(true)}
            disabled={currentLocation.type === 'root'}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Folder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onUpload}
            disabled={currentLocation.type === 'root'}
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload
          </Button>
        </div>
      </div>

      {/* New Folder Input */}
      {showNewFolderInput && (
        <div className="p-4 border-b bg-blue-50">
          <div className="flex items-center space-x-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }
              }}
            />
            <Button onClick={handleCreateFolder} size="sm">
              Create
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setShowNewFolderInput(false);
                setNewFolderName('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* File Grid */}
      <div className="flex-1 p-4 overflow-auto">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-200 rounded-lg mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {currentLocation.type === 'root' ? 'No clients yet' : 'Empty folder'}
            </h3>
            <p className="text-gray-600">
              {currentLocation.type === 'root' 
                ? 'Create your first client to get started' 
                : 'Upload documents or create folders to organize your files'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map((item) => (
              <Card
                key={item.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  selectedItems.includes(item.id) ? 'bg-blue-50 border-blue-300' : ''
                }`}
                onClick={() => {
                  if (selectedItems.includes(item.id)) {
                    setSelectedItems(selectedItems.filter(id => id !== item.id));
                  } else {
                    setSelectedItems([...selectedItems, item.id]);
                  }
                }}
                onDoubleClick={() => navigateInto(item)}
              >
                <CardContent className="p-4 text-center">
                  <div className="mb-2">
                    {item.type === 'folder' ? (
                      <Folder className="h-12 w-12 text-blue-500 mx-auto" />
                    ) : (
                      <FileText className="h-12 w-12 text-gray-500 mx-auto" />
                    )}
                  </div>
                  <h4 className="text-sm font-medium truncate mb-1">{item.name}</h4>
                  <div className="text-xs text-gray-500">
                    {item.size && <div>{formatSize(item.size)}</div>}
                    <div>{formatDate(item.modified)}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Selection Actions */}
      {selectedItems.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                Move
              </Button>
              <Button variant="outline" size="sm">
                Download
              </Button>
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
