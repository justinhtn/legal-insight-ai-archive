
import React, { useState } from 'react';
import { 
  Folder, 
  FileText, 
  ChevronRight, 
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  modified: string;
  kind?: string;
}

interface FileTableViewProps {
  items: FileItem[];
  selectedItems: string[];
  onItemClick: (item: FileItem) => void;
  onItemDoubleClick: (item: FileItem) => void;
}

type SortField = 'name' | 'modified' | 'size' | 'kind';
type SortDirection = 'asc' | 'desc';

const FileTableView: React.FC<FileTableViewProps> = ({
  items,
  selectedItems,
  onItemClick,
  onItemDoubleClick
}) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '--';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getKind = (item: FileItem): string => {
    if (item.type === 'folder') return 'Folder';
    if (item.kind) return item.kind;
    
    const extension = item.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'PDF Document';
      case 'doc':
      case 'docx': return 'Word Document';
      case 'txt': return 'Text Document';
      case 'jpg':
      case 'jpeg':
      case 'png': return 'Image';
      default: return 'Document';
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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-3 w-3" /> : 
      <ArrowDown className="h-3 w-3" />;
  };

  const sortedItems = [...items].sort((a, b) => {
    // Always put folders first
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }

    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    // Handle special cases
    if (sortField === 'kind') {
      aValue = getKind(a);
      bValue = getKind(b);
    } else if (sortField === 'modified') {
      aValue = new Date(a.modified).getTime();
      bValue = new Date(b.modified).getTime();
    } else if (sortField === 'size') {
      aValue = a.size || 0;
      bValue = b.size || 0;
    }

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  return (
    <div className="bg-white rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-gray-50/50">
            <TableHead 
              className="w-1/2 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center space-x-1">
                <span className="font-medium text-gray-700">Name</span>
                {getSortIcon('name')}
              </div>
            </TableHead>
            <TableHead 
              className="w-1/6 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('modified')}
            >
              <div className="flex items-center space-x-1">
                <span className="font-medium text-gray-700">Date Modified</span>
                {getSortIcon('modified')}
              </div>
            </TableHead>
            <TableHead 
              className="w-1/6 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('size')}
            >
              <div className="flex items-center space-x-1">
                <span className="font-medium text-gray-700">Size</span>
                {getSortIcon('size')}
              </div>
            </TableHead>
            <TableHead 
              className="w-1/6 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('kind')}
            >
              <div className="flex items-center space-x-1">
                <span className="font-medium text-gray-700">Kind</span>
                {getSortIcon('kind')}
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item, index) => (
            <TableRow
              key={item.id}
              className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                selectedItems.includes(item.id) ? 'bg-blue-100' : index % 2 === 1 ? 'bg-gray-50/30' : ''
              }`}
              onClick={() => onItemClick(item)}
              onDoubleClick={() => onItemDoubleClick(item)}
            >
              <TableCell className="py-1.5">
                <div className="flex items-center space-x-2">
                  {item.type === 'folder' ? (
                    <>
                      <ChevronRight className="h-3 w-3 text-gray-400" />
                      <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    </>
                  ) : (
                    <>
                      <div className="w-3" /> {/* Spacer for alignment */}
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    </>
                  )}
                  <span className="truncate text-sm">{item.name}</span>
                </div>
              </TableCell>
              <TableCell className="py-1.5 text-sm text-gray-600">
                {formatDate(item.modified)}
              </TableCell>
              <TableCell className="py-1.5 text-sm text-gray-600">
                {item.type === 'folder' ? '--' : formatSize(item.size)}
              </TableCell>
              <TableCell className="py-1.5 text-sm text-gray-600">
                {getKind(item)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Folder className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <p>This folder is empty</p>
        </div>
      )}
    </div>
  );
};

export default FileTableView;
