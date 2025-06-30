
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { getDocumentContent } from '@/services/documentContentService';
import { useEffect } from 'react';

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

  // Load tabs from session storage on mount
  useEffect(() => {
    const savedTabs = sessionStorage.getItem('documentTabs');
    const savedActiveTab = sessionStorage.getItem('activeTabId');
    const savedShowOverview = sessionStorage.getItem('showOverview');
    
    if (savedTabs) {
      try {
        const parsedTabs = JSON.parse(savedTabs);
        setOpenTabs(parsedTabs);
      } catch (error) {
        console.error('Failed to parse saved tabs:', error);
      }
    }
    
    if (savedActiveTab) {
      setActiveTabId(savedActiveTab);
    }
    
    if (savedShowOverview !== null) {
      setShowOverview(savedShowOverview === 'true');
    }
  }, [setOpenTabs, setActiveTabId, setShowOverview]);

  // Save tabs to session storage whenever they change
  useEffect(() => {
    sessionStorage.setItem('documentTabs', JSON.stringify(openTabs));
  }, [openTabs]);

  useEffect(() => {
    if (activeTabId) {
      sessionStorage.setItem('activeTabId', activeTabId);
    }
  }, [activeTabId]);

  useEffect(() => {
    sessionStorage.setItem('showOverview', showOverview.toString());
  }, [showOverview]);

  const handleTabChange = (tabId: string) => {
    console.log('Switching to tab:', tabId);
    setActiveTabId(tabId);
    setShowOverview(false);
  };

  const handleCloseTab = (tabId: string) => {
    console.log('Closing tab:', tabId);
    setOpenTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      
      // If we're closing the active tab, switch to another tab or show overview
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          // Switch to the last tab in the list
          const lastTab = newTabs[newTabs.length - 1];
          setActiveTabId(lastTab.id);
          setShowOverview(false);
        } else {
          // No tabs left, show overview
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
        // Update existing tab with new highlights
        const updated = [...prev];
        updated[existingIndex] = newTab;
        setActiveTabId(newTab.id);
        setShowOverview(false);
        return updated;
      }
      
      // Add new tab
      const newTabs = [...prev, newTab];
      setActiveTabId(newTab.id);
      setShowOverview(false);
      return newTabs;
    });
  };

  const handleFileClick = async (file: any) => {
    console.log('Opening file:', file);
    
    if (file.type === 'document' || file.type === 'file') {
      // Check if tab already exists
      const existingTab = openTabs.find(tab => tab.id === file.id);
      if (existingTab) {
        setActiveTabId(file.id);
        setShowOverview(false);
        return;
      }

      // Fetch the actual document content
      let content = '';
      try {
        content = await getDocumentContent(file.id);
      } catch (error) {
        console.error('Failed to fetch document content:', error);
        content = 'Failed to load document content. Please try again.';
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
      
      setOpenTabs(prev => {
        const newTabs = [...prev, newTab];
        setActiveTabId(file.id);
        setShowOverview(false);
        return newTabs;
      });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + W to close current tab
      if ((event.ctrlKey || event.metaKey) && event.key === 'w') {
        event.preventDefault();
        if (activeTabId && openTabs.length > 0) {
          handleCloseTab(activeTabId);
        }
      }
      
      // Ctrl/Cmd + T to show overview (like new tab)
      if ((event.ctrlKey || event.metaKey) && event.key === 't') {
        event.preventDefault();
        handleShowOverview();
      }
      
      // Ctrl/Cmd + 1-9 to switch tabs
      if ((event.ctrlKey || event.metaKey) && event.key >= '1' && event.key <= '9') {
        event.preventDefault();
        const tabIndex = parseInt(event.key) - 1;
        if (tabIndex === 0) {
          handleShowOverview();
        } else if (openTabs[tabIndex - 1]) {
          handleTabChange(openTabs[tabIndex - 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, openTabs, handleTabChange, handleCloseTab, handleShowOverview]);

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
