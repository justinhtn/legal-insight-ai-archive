
import React from 'react';
import { FileText, Lightbulb, X } from 'lucide-react';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';

const DocumentTabManager: React.FC = () => {
  const { openTabs, activeTabId, showOverview, handleTabChange, handleCloseTab, handleShowOverview } = useDocumentTabs();

  if (openTabs.length === 0) return null;

  return (
    <div className="document-tabs">
      {/* Overview Tab */}
      <div
        onClick={handleShowOverview}
        className={`document-tab ${showOverview ? 'active overview-tab' : ''}`}
      >
        <span className="tab-title">Overview</span>
      </div>

      {/* Document Tabs */}
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`document-tab ${activeTabId === tab.id ? 'active' : ''}`}
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="tab-title">{tab.title}</span>
          {tab.highlights.length > 0 && (
            <Lightbulb className="h-3 w-3 text-yellow-500 flex-shrink-0" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCloseTab(tab.id);
            }}
            className="close-button"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default DocumentTabManager;
