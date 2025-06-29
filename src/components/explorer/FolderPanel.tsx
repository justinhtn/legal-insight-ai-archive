
import React from 'react';
import { Folder, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Folder as FolderType } from '@/services/clientService';

interface FolderPanelProps {
  folders: FolderType[];
  selectedFolderId?: string;
  onFolderSelect: (folderId: string | null) => void;
  onNewFolder: () => void;
  isLoading?: boolean;
}

const FolderPanel: React.FC<FolderPanelProps> = ({
  folders,
  selectedFolderId,
  onFolderSelect,
  onNewFolder,
  isLoading = false
}) => {
  const rootFolders = folders.filter(f => !f.parent_folder_id);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">Folders</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewFolder}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          New Folder
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Loading folders...</div>
      ) : (
        <div className="grid grid-cols-6 gap-2">
          {/* Client Root Option */}
          <button
            onClick={() => onFolderSelect(null)}
            className={`flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 transition-colors ${
              !selectedFolderId ? 'bg-blue-50 border border-blue-200' : ''
            }`}
          >
            <Folder className={`h-8 w-8 mb-1 ${!selectedFolderId ? 'text-blue-600' : 'text-gray-500'}`} />
            <span className="text-xs text-center font-medium">Client Root</span>
          </button>

          {/* Folder Options */}
          {rootFolders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onFolderSelect(folder.id)}
              className={`flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 transition-colors ${
                selectedFolderId === folder.id ? 'bg-blue-50 border border-blue-200' : ''
              }`}
            >
              <Folder className={`h-8 w-8 mb-1 ${
                selectedFolderId === folder.id ? 'text-blue-600' : 'text-gray-500'
              }`} />
              <span className="text-xs text-center truncate w-full" title={folder.name}>
                {folder.name}
              </span>
            </button>
          ))}

          {rootFolders.length === 0 && (
            <div className="col-span-6 text-center py-8 text-gray-500">
              <Folder className="mx-auto h-12 w-12 text-gray-300 mb-2" />
              <p>No folders yet</p>
              <p className="text-xs">Create your first folder to organize documents</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FolderPanel;
