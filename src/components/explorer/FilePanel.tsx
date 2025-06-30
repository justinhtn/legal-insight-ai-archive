
import React from 'react';
import { FileText, Upload, RefreshCw, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  modified: string;
}

interface FilePanelProps {
  files: FileItem[];
  selectedFolderId?: string;
  folderName?: string | null;
  onUpload: () => void;
  isLoading?: boolean;
  onRefresh: () => void;
  onFileClick?: (file: FileItem) => void;
}

const FilePanel: React.FC<FilePanelProps> = ({
  files,
  selectedFolderId,
  folderName,
  onUpload,
  isLoading = false,
  onRefresh,
  onFileClick
}) => {
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

  const getFileKind = (file: FileItem) => {
    if (file.type === 'folder') return 'Folder';
    const extension = file.name.split('.').pop()?.toUpperCase();
    return extension || 'Document';
  };

  const handleFileClick = (file: FileItem) => {
    if (onFileClick && file.type === 'file') {
      onFileClick(file);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with buttons */}
      <div className="p-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">
            Files {selectedFolderId && folderName && (
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
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <p className="font-medium">No files yet</p>
            <p className="text-sm mb-4">
              {selectedFolderId ? 'This folder is empty' : 'No files in client root'}
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
                <TableHead className="text-left font-medium text-gray-700">Name</TableHead>
                <TableHead className="text-left font-medium text-gray-700">Date Modified</TableHead>
                <TableHead className="text-left font-medium text-gray-700">Size</TableHead>
                <TableHead className="text-left font-medium text-gray-700">Kind</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file, index) => (
                <TableRow
                  key={file.id}
                  className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  } ${file.type === 'file' ? 'hover:bg-blue-100' : ''}`}
                  onClick={() => handleFileClick(file)}
                >
                  <TableCell className="py-2">
                    <div className="flex items-center">
                      {file.type === 'folder' ? (
                        <Folder className="h-4 w-4 text-blue-500 mr-3" />
                      ) : (
                        <FileText className="h-4 w-4 text-gray-500 mr-3" />
                      )}
                      <span className="font-medium text-gray-900">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-gray-600 text-sm">
                    {formatDate(file.modified)}
                  </TableCell>
                  <TableCell className="py-2 text-gray-600 text-sm">
                    {formatFileSize(file.size)}
                  </TableCell>
                  <TableCell className="py-2 text-gray-600 text-sm">
                    {getFileKind(file)}
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
