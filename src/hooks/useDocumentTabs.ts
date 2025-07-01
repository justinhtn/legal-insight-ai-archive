
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { getDocumentContent } from '@/services/documentContentService';

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
    console.log('Changing to tab:', tabId);
    setActiveTabId(tabId);
    setShowOverview(false);
  };

  const handleCloseTab = (tabId: string) => {
    console.log('Closing tab:', tabId);
    setOpenTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          const nextActiveTab = newTabs[newTabs.length - 1];
          setActiveTabId(nextActiveTab.id);
          setShowOverview(false);
        } else {
          setActiveTabId(null);
          setShowOverview(true);
        }
      }
      return newTabs;
    });
  };

  const handleShowOverview = () => {
    console.log('Showing overview');
    setShowOverview(true);
    setActiveTabId(null);
  };

  const handleDocumentOpen = async (document: any, highlights: any[], query: string) => {
    console.log('Opening document with highlights', { document, highlights, query });
    
    // Fetch the actual document content
    let content = '';
    try {
      content = await getDocumentContent(document.id);
      console.log('Fetched document content, length:', content.length);
    } catch (error) {
      console.error('Failed to fetch document content:', error);
      content = 'Failed to load document content';
    }
    
    const newTab: DocumentTabData = {
      id: document.document_file_name || document.id,
      name: document.document_title || document.name,
      type: 'document',
      title: document.document_title || document.name,
      content: content,
      highlights: highlights,
      query: query
    };
    
    setOpenTabs(prev => {
      const existingIndex = prev.findIndex(tab => tab.id === newTab.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newTab;
        console.log('Updated existing tab:', newTab.id);
        setActiveTabId(newTab.id);
        setShowOverview(false);
        return updated;
      }
      const newTabs = [...prev, newTab];
      console.log('Added new tab:', newTab.id, 'Total tabs:', newTabs.length);
      setActiveTabId(newTab.id);
      setShowOverview(false);
      return newTabs;
    });
  };

  const handleFileClick = async (file: any) => {
    console.log('File clicked:', file);
    
    if (file.type === 'document' || file.type === 'file' || !file.type) {
      // Fetch the actual document content
      let content = '';
      try {
        content = await getDocumentContent(file.id);
        console.log('Fetched document content for file click, length:', content.length);
      } catch (error) {
        console.error('Failed to fetch document content:', error);
        content = 'Failed to load document content';
      }

      const newTab: DocumentTabData = { 
        id: file.id, 
        name: file.name, 
        type: 'document',
        title: file.name,
        content: content,
        highlights: [],
        query: ''
      };
      
      console.log('Creating new tab for file:', newTab);
      
      setOpenTabs(prev => {
        const existingIndex = prev.findIndex(tab => tab.id === file.id);
        if (existingIndex >= 0) {
          console.log('Tab already exists, switching to it:', file.id);
          setActiveTabId(file.id);
          setShowOverview(false);
          return prev;
        }
        const newTabs = [...prev, newTab];
        console.log('Added new tab for file:', file.id, 'Total tabs:', newTabs.length);
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
