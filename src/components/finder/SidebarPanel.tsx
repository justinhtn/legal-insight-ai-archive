
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Folder } from 'lucide-react';

interface SidebarItem {
  id: string;
  name: string;
  type: 'folder';
}

interface SidebarPanelProps {
  clientName: string;
  folders: SidebarItem[];
  selectedFolderId?: string;
  onFolderClick: (folderId: string) => void;
  onNewFolder: () => void;
}

const SidebarPanel: React.FC<SidebarPanelProps> = ({
  clientName,
  folders,
  selectedFolderId,
  onFolderClick,
  onNewFolder
}) => {
  return (
    <div className="w-80 border-r bg-gray-50 flex flex-col">
      <div className="p-4 border-b bg-white">
        <h2 className="font-semibold text-lg truncate" title={clientName}>
          {clientName}
        </h2>
      </div>
      
      <div className="flex-1 p-2">
        <div className="space-y-1">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onFolderClick(folder.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center hover:bg-white transition-colors ${
                selectedFolderId === folder.id ? 'bg-blue-100 text-blue-900' : 'text-gray-700'
              }`}
            >
              <Folder className="h-4 w-4 mr-2 text-blue-500" />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t bg-white">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewFolder}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Folder
        </Button>
      </div>
    </div>
  );
};

export default SidebarPanel;
