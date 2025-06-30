
import { useFileExplorer } from '@/contexts/FileExplorerContext';

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

export const useDocumentTabs = () => {
  const {
    openTabs,
    setOpenTabs,
    activeTabId,
    setActiveTabId,
    showOverview,
    setShowOverview,
  } = useFileExplorer();

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
    setShowOverview(false);
  };

  const handleCloseTab = (tabId: string) => {
    setOpenTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          setActiveTabId(newTabs[newTabs.length - 1].id);
        } else {
          setActiveTabId(null);
          setShowOverview(true);
        }
      }
      return newTabs;
    });
  };

  const handleShowOverview = () => {
    setShowOverview(true);
    setActiveTabId(null);
  };

  const handleDocumentOpen = (document: any, highlights: any[], query: string) => {
    console.log('Opening document with highlights', { document, highlights, query });
    
    const newTab: DocumentTabData = {
      id: document.document_file_name || document.id,
      name: document.document_title || document.name,
      type: 'document',
      title: document.document_title || document.name,
      content: '',
      highlights: highlights,
      query: query
    };
    
    setOpenTabs(prev => {
      const existingIndex = prev.findIndex(tab => tab.id === newTab.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newTab;
        setActiveTabId(newTab.id);
        setShowOverview(false);
        return updated;
      }
      const newTabs = [...prev, newTab];
      setActiveTabId(newTab.id);
      setShowOverview(false);
      return newTabs;
    });
  };

  const handleFileClick = (file: any) => {
    if (file.type === 'document' || file.type === 'file') {
      const newTab: DocumentTabData = { 
        id: file.id, 
        name: file.name, 
        type: 'document',
        title: file.name,
        content: '',
        highlights: [],
        query: ''
      };
      setOpenTabs(prev => {
        const existingIndex = prev.findIndex(tab => tab.id === file.id);
        if (existingIndex >= 0) {
          setActiveTabId(file.id);
          setShowOverview(false);
          return prev;
        }
        const newTabs = [...prev, newTab];
        setActiveTabId(file.id);
        setShowOverview(false);
        return newTabs;
      });
    }
  };

  return {
    openTabs,
    activeTabId,
    showOverview,
    handleTabChange,
    handleCloseTab,
    handleShowOverview,
    handleDocumentOpen,
    handleFileClick,
  };
};
