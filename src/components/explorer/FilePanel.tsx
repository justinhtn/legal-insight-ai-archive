
import React from 'react';
import { Folder, File, Upload, RefreshCw, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder as FolderType } from '@/services/clientService';

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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${kb.toFixed(1)} KB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Breadcrumbs */}
      <div className="p-4 border-b bg-gray-50 flex-shrink-0">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 mb-4">
          <Home className="h-4 w-4 text-gray-500" />
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id || 'root'}>
              {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              <button
                onClick={() => crumb.id ? onFolderClick(crumb.id) : onNavigateToRoot()}
                className={`text-sm ${
                  index === breadcrumbs.length - 1
                    ? 'text-gray-900 font-medium'
                    : 'text-blue-600 hover:text-blue-800 hover:underline'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Files & Folders
          </h3>
          <div className="flex space-x-2">
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={onUpload}
              size="sm"
              className="flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-2">
            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Loading files and folders...</p>
              </div>
            ) : (
              <>
                {/* Folders */}
                {folders.map((folder) => (
                  <Card
                    key={folder.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onFolderClick(folder.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-3">
                        <Folder className="h-5 w-5 text-blue-500" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{folder.name}</p>
                          <p className="text-sm text-gray-500">
                            Modified {formatDate(folder.updated_at)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Files */}
                {files.map((file) => (
                  <Card
                    key={file.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onFileClick?.(file)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-3">
                        <File className="h-5 w-5 text-gray-500" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(file.size)} • Modified {formatDate(file.modified)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Empty State */}
                {folders.length === 0 && files.length === 0 && (
                  <div className="text-center py-8">
                    <Folder className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {selectedFolderId ? 'Folder is empty' : 'No files or folders'}
                    </h3>
                    <p className="text-gray-600">
                      {selectedFolderId 
                        ? 'Upload files to this folder to get started'
                        : 'Upload your first document or create a folder to organize your files'
                      }
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default FilePanel;
