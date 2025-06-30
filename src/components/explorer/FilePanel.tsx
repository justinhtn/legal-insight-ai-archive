
import React, { useState } from 'react';
import { FileText, Upload, RefreshCw, Folder, ChevronUp, ChevronDown, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  modified: string;
}

interface FilePanelProps {
  files: FileItem[];
  folders: any[];
  selectedFolderId?: string;
  folderName?: string | null;
  onUpload: () => void;
  isLoading?: boolean;
  onRefresh: () => void;
  onFileClick?: (file: FileItem) => void;
  onFolderClick?: (folderId: string) => void;
  onNavigateToRoot?: () => void;
}

type SortField = 'name' | 'modified' | 'size' | 'kind';
type SortDirection = 'asc' | 'desc';

const FilePanel: React.FC<FilePanelProps> = ({
  files,
  folders,
  selectedFolderId,
  folderName,
  onUpload,
  isLoading = false,
  onRefresh,
  onFileClick,
  onFolderClick,
  onNavigateToRoot
}) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '--';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fileDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (fileDate.getTime() === today.getTime()) {
      return 'Today at ' + date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }) + ' at ' + date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const getFileKind = (item: FileItem | any) => {
    if (item.type === 'folder') return 'Folder';
    const extension = item.name.split('.').pop()?.toUpperCase();
    return extension || 'Document';
  };

  const handleItemClick = (item: FileItem | any) => {
    if (item.type === 'folder') {
      onFolderClick?.(item.id);
    } else if (onFileClick && item.type === 'file') {
      onFileClick(item);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Combine folders and files into one list
  const allItems = [
    ...folders.map(folder => ({
      ...folder,
      type: 'folder' as const,
      modified: folder.updated_at || folder.created_at
    })),
    ...files
  ];

  // Sort items
  const sortedItems = [...allItems].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'modified':
        aValue = new Date(a.modified);
        bValue = new Date(b.modified);
        break;
      case 'size':
        aValue = a.size || 0;
        bValue = b.size || 0;
        break;
      case 'kind':
        aValue = getFileKind(a);
        bValue = getFileKind(b);
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-3 w-3 inline ml-1" /> : 
      <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb Navigation */}
      <div className="px-4 py-2 border-b bg-gray-50 flex-shrink-0">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                className="flex items-center gap-1 cursor-pointer hover:text-blue-600"
                onClick={onNavigateToRoot}
              >
                <Home className="h-3 w-3" />
                All Items
              </BreadcrumbLink>
            </BreadcrumbItem>
            {selectedFolderId && folderName && (
              <>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3 w-3" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>{folderName}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header with buttons */}
      <div className="p-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">
            All Items {selectedFolderId && folderName && (
              <span className="text-gray-500">in {folderName}</span>
            )}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onUpload}
            >
              <Upload className="h-3 w-3 mr-1" />
              Upload Files
            </Button>
          </div>
        </div>
      </div>

      {/* File table - scrollable content area */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2"></div>
            Loading items...
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <p className="font-medium">No items yet</p>
            <p className="text-sm mb-4">
              {selectedFolderId ? 'This folder is empty' : 'No items in client root'}
            </p>
            <Button onClick={onUpload} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload First File
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 z-10">
              <TableRow>
                <TableHead 
                  className="text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Name <SortIcon field="name" />
                </TableHead>
                <TableHead 
                  className="text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('modified')}
                >
                  Date Modified <SortIcon field="modified" />
                </TableHead>
                <TableHead 
                  className="text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('size')}
                >
                  Size <SortIcon field="size" />
                </TableHead>
                <TableHead 
                  className="text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('kind')}
                >
                  Kind <SortIcon field="kind" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item, index) => (
                <TableRow
                  key={item.id}
                  className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  } hover:bg-blue-100`}
                  onClick={() => handleItemClick(item)}
                >
                  <TableCell className="py-2">
                    <div className="flex items-center">
                      {item.type === 'folder' ? (
                        <Folder className="h-4 w-4 text-blue-500 mr-3" />
                      ) : (
                        <FileText className="h-4 w-4 text-gray-500 mr-3" />
                      )}
                      <span className="font-medium text-gray-900">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-gray-600 text-sm">
                    {formatDate(item.modified)}
                  </TableCell>
                  <TableCell className="py-2 text-gray-600 text-sm">
                    {formatFileSize(item.size)}
                  </TableCell>
                  <TableCell className="py-2 text-gray-600 text-sm">
                    {getFileKind(item)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default FilePanel;
