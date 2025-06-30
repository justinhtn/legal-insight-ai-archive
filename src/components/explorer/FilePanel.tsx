
import React from 'react';
import { Upload, RefreshCw, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder as FolderType } from '@/services/clientService';
import FileTableView from '../finder/FileTableView';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  modified: string;
}

interface FilePanelProps {
  files: FileItem[];
  folders: FolderType[];
  selectedFolderId?: string;
  folderName?: string | null;
  onUpload: () => void;
  isLoading: boolean;
  onRefresh: () => void;
  onFileClick?: (file: FileItem) => void;
  onFolderClick: (folderId: string) => void;
  onNavigateToRoot: () => void;
  allFolders?: FolderType[];
}

const FilePanel: React.FC<FilePanelProps> = ({
  files,
  folders,
  selectedFolderId,
  folderName,
  onUpload,
  isLoading,
  onRefresh,
  onFileClick,
  onFolderClick,
  onNavigateToRoot,
  allFolders = []
}) => {
  // Generate breadcrumb path
  const generateBreadcrumbs = () => {
    if (!selectedFolderId || !allFolders.length) {
      return [{ name: 'All Items', id: null }];
    }

    const breadcrumbs = [{ name: 'All Items', id: null }];
    let currentFolder = allFolders.find(f => f.id === selectedFolderId);
    const path = [];

    // Build path from current folder to root
    while (currentFolder) {
      path.unshift(currentFolder);
      currentFolder = allFolders.find(f => f.id === currentFolder?.parent_folder_id);
    }

    // Add path to breadcrumbs
    path.forEach(folder => {
      breadcrumbs.push({ name: folder.name, id: folder.id });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Combine folders and files for the table view
  const allItems: FileItem[] = [
    ...folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      type: 'folder' as const,
      modified: folder.updated_at,
      size: undefined
    })),
    ...files
  ];

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'folder') {
      onFolderClick(item.id);
    } else {
      onFileClick?.(item);
    }
  };

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.type === 'folder') {
      onFolderClick(item.id);
    } else {
      onFileClick?.(item);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b bg-gray-50/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center space-x-1 text-sm">
              <Home className="h-4 w-4 text-gray-500" />
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.id || 'root'}>
                  {index > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
                  <button
                    onClick={() => crumb.id ? onFolderClick(crumb.id) : onNavigateToRoot()}
                    className={`px-1 py-0.5 rounded text-sm transition-colors ${
                      index === breadcrumbs.length - 1
                        ? 'text-gray-900 font-medium'
                        : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              disabled={isLoading}
              className="h-8 px-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={onUpload}
              size="sm"
              className="h-8 px-3"
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500 text-sm">Loading files and folders...</p>
            </div>
          </div>
        ) : allItems.length > 0 ? (
          <FileTableView
            items={allItems}
            selectedItems={[]} // You can implement selection state if needed
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center">
                <Home className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {selectedFolderId ? 'Folder is empty' : 'No files or folders'}
              </h3>
              <p className="text-gray-500 text-sm max-w-sm">
                {selectedFolderId 
                  ? 'Upload files to this folder to get started'
                  : 'Upload your first document or create a folder to organize your files'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePanel;
