
import React from 'react';
import { Folder, FileText } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  modified: string;
  kind?: string;
}

interface FileListViewProps {
  items: FileItem[];
  selectedItems: string[];
  onItemClick: (item: FileItem) => void;
  onItemDoubleClick: (item: FileItem) => void;
}

const FileListView: React.FC<FileListViewProps> = ({
  items,
  selectedItems,
  onItemClick,
  onItemDoubleClick
}) => {
  const formatSize = (bytes?: number): string => {
    if (!bytes) return '--';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getKind = (item: FileItem): string => {
    if (item.type === 'folder') return 'Folder';
    if (item.kind) return item.kind;
    return 'Document';
  };

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b sticky top-0">
          <tr>
            <th className="text-left py-2 px-4 font-medium">Name</th>
            <th className="text-left py-2 px-4 font-medium">Date Modified</th>
            <th className="text-left py-2 px-4 font-medium">Size</th>
            <th className="text-left py-2 px-4 font-medium">Kind</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={`hover:bg-blue-50 cursor-pointer border-b border-gray-100 ${
                selectedItems.includes(item.id) ? 'bg-blue-100' : ''
              }`}
              onClick={() => onItemClick(item)}
              onDoubleClick={() => onItemDoubleClick(item)}
            >
              <td className="py-2 px-4 flex items-center">
                {item.type === 'folder' ? (
                  <Folder className="h-4 w-4 text-blue-500 mr-2" />
                ) : (
                  <FileText className="h-4 w-4 text-gray-500 mr-2" />
                )}
                <span className="truncate">{item.name}</span>
              </td>
              <td className="py-2 px-4 text-gray-600">
                {formatDate(item.modified)}
              </td>
              <td className="py-2 px-4 text-gray-600">
                {formatSize(item.size)}
              </td>
              <td className="py-2 px-4 text-gray-600">
                {getKind(item)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Folder className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <p>This folder is empty</p>
        </div>
      )}
    </div>
  );
};

export default FileListView;
