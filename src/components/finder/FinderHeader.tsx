
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search,
  Upload,
  Plus,
  List,
  Grid2X2,
  Columns3
} from 'lucide-react';

interface FinderHeaderProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  viewMode: 'list' | 'icon' | 'column';
  onViewModeChange: (mode: 'list' | 'icon' | 'column') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewFolder: () => void;
  onUpload: () => void;
  currentPath: string[];
}

const FinderHeader: React.FC<FinderHeaderProps> = ({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  onNewFolder,
  onUpload,
  currentPath
}) => {
  const isInClient = currentPath.length > 1;

  return (
    <div className="flex items-center justify-between p-3 border-b bg-gray-50 space-x-4">
      {/* Navigation Controls */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={!canGoBack}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onForward}
          disabled={!canGoForward}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex items-center bg-white rounded-md border">
        <Button
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('list')}
          className="rounded-r-none border-r"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'icon' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('icon')}
          className="rounded-none border-r"
        >
          <Grid2X2 className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'column' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('column')}
          className="rounded-l-none"
        >
          <Columns3 className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="search"
          placeholder="Search files and folders..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewFolder}
          disabled={!isInClient}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onUpload}
          disabled={!isInClient}
        >
          <Upload className="h-4 w-4 mr-1" />
          Upload
        </Button>
      </div>
    </div>
  );
};

export default FinderHeader;
