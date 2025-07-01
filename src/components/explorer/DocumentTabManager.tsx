
import React from 'react';
import { X, Home } from 'lucide-react';
import { useFileExplorer } from '@/contexts/FileExplorerContext';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';

const DocumentTabManager: React.FC = () => {
  const { openTabs, activeTabId, showOverview } = useFileExplorer();
  const { handleTabChange, handleCloseTab, handleShowOverview } = useDocumentTabs();

  return (
    <div className="document-tabs">
      <div className="tabs-container">
        {/* Always show Overview tab */}
        <button
          className={`tab-button overview-tab ${showOverview || activeTabId === null ? 'active' : ''}`}
          onClick={handleShowOverview}
        >
          <Home className="tab-icon" />
          <span className="tab-name">Overview</span>
        </button>

        {/* Document tabs */}
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-button ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className="tab-name" title={tab.name}>
              {tab.name}
            </span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(tab.id);
              }}
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
