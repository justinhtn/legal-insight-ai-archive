
import React from 'react';
import { FileText, Lightbulb, X, Home } from 'lucide-react';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';

const DocumentTabManager: React.FC = () => {
  const { openTabs, activeTabId, showOverview, handleTabChange, handleCloseTab, handleShowOverview } = useDocumentTabs();

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Tab close button clicked for:', tabId);
    handleCloseTab(tabId);
  };

  const getTabStyle = (isActive: boolean, isOverview: boolean = false) => {
    const baseStyle = "flex items-center gap-2 px-4 py-3 border-r border-gray-200 cursor-pointer transition-all duration-200 min-w-0 max-w-64";
    
    if (isActive) {
      return `${baseStyle} bg-white text-gray-900 border-b-2 border-blue-500 font-medium shadow-sm`;
    } else {
      return `${baseStyle} bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800`;
    }
  };

  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
        {/* Overview Tab - Always Present */}
        <div
          onClick={handleShowOverview}
          className={getTabStyle(showOverview, true)}
        >
          <Home className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">📁 Overview</span>
        </div>

        {/* Document Tabs */}
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={getTabStyle(activeTabId === tab.id)}
          >
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">📄 {tab.title}</span>
            {tab.highlights.length > 0 && (
              <Lightbulb className="h-3 w-3 text-yellow-500 flex-shrink-0" />
            )}
            <button
              onClick={(e) => handleTabClose(e, tab.id)}
              className="flex-shrink-0 ml-2 hover:bg-gray-200 rounded p-1 -m-1 opacity-0 group-hover:opacity-100 transition-opacity"
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentTabManager;
