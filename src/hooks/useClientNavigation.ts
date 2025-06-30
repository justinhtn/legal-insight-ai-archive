
import { useFileExplorer } from '@/contexts/FileExplorerContext';

export const useClientNavigation = () => {
  const {
    selectedClientId,
    selectedFolderId,
    setSelectedClientId,
    setSelectedFolderId,
  } = useFileExplorer();

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedFolderId(undefined);
  };

  const handleFolderClick = (folderId: string) => {
    setSelectedFolderId(folderId);
  };

  const handleNavigateToRoot = () => {
    setSelectedFolderId(undefined);
  };

  return {
    selectedClientId,
    selectedFolderId,
    handleClientSelect,
    handleFolderClick,
    handleNavigateToRoot,
  };
};
