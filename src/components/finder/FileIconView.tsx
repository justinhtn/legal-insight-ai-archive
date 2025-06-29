
import React from 'react';
import { Folder, FileText } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  modified: string;
}

interface FileIconViewProps {
  items: FileItem[];
  selectedItems: string[];
  onItemClick: (item: FileItem) => void;
  onItemDoubleClick: (item: FileItem) => void;
}

const FileIconView: React.FC<FileIconViewProps> = ({
  items,
  selectedItems,
  onItemClick,
  onItemDoubleClick
}) => {
  return (
    <div className="p-4 overflow-auto">
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Folder className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <p>This folder is empty</p>
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col items-center p-3 rounded-lg cursor-pointer hover:bg-blue-50 ${
                selectedItems.includes(item.id) ? 'bg-blue-100' : ''
              }`}
              onClick={() => onItemClick(item)}
              onDoubleClick={() => onItemDoubleClick(item)}
            >
              <div className="mb-2">
                {item.type === 'folder' ? (
                  <Folder className="h-12 w-12 text-blue-500" />
                ) : (
                  <FileText className="h-12 w-12 text-gray-500" />
                )}
              </div>
              <span className="text-sm text-center truncate w-full" title={item.name}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileIconView;
