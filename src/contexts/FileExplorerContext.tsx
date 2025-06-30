
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Client } from '@/services/clientService';

interface DocumentTabData {
  id: string;
  name: string;
  type: 'document' | 'folder';
  title: string;
  content: string;
  highlights: Array<{
    text: string;
    page?: number;
    lines?: string;
  }>;
  query: string;
}

interface FileExplorerContextType {
  selectedClientId?: string;
  selectedFolderId?: string;
  openTabs: DocumentTabData[];
  activeTabId: string | null;
  showOverview: boolean;
  isChatOpen: boolean;
  setSelectedClientId: (id: string) => void;
  setSelectedFolderId: (id?: string) => void;
  setOpenTabs: React.Dispatch<React.SetStateAction<DocumentTabData[]>>;
  setActiveTabId: (id: string | null) => void;
  setShowOverview: (show: boolean) => void;
  setIsChatOpen: (open: boolean) => void;
}

const FileExplorerContext = createContext<FileExplorerContextType | undefined>(undefined);

export const useFileExplorer = () => {
  const context = useContext(FileExplorerContext);
  if (!context) {
    throw new Error('useFileExplorer must be used within a FileExplorerProvider');
  }
  return context;
};

interface FileExplorerProviderProps {
  children: ReactNode;
}

export const FileExplorerProvider: React.FC<FileExplorerProviderProps> = ({ children }) => {
  const [selectedClientId, setSelectedClientId] = useState<string>();
  const [selectedFolderId, setSelectedFolderId] = useState<string>();
  const [openTabs, setOpenTabs] = useState<DocumentTabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <FileExplorerContext.Provider
      value={{
        selectedClientId,
        selectedFolderId,
        openTabs,
        activeTabId,
        showOverview,
        isChatOpen,
        setSelectedClientId,
        setSelectedFolderId,
        setOpenTabs,
        setActiveTabId,
        setShowOverview,
        setIsChatOpen,
      }}
    >
      {children}
    </FileExplorerContext.Provider>
  );
};
