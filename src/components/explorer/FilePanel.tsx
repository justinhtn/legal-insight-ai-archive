
import React from 'react';
import { FileText, Upload, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
}

const FilePanel: React.FC<FilePanelProps> = ({
  files,
  selectedFolderId,
  folderName,
  onUpload,
  isLoading = false,
  onRefresh
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
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
          <div className="p-4">
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center p-3 hover:bg-gray-50 rounded-lg border"
                >
                  <FileText className="h-5 w-5 text-gray-500 mr-3" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {file.size && formatFileSize(file.size)} • {formatDate(file.modified)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePanel;
