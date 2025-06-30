
import React from 'react';

interface DocumentTab {
  id: string;
  name: string;
  icon: string;
  fileName?: string;
  clientId?: string;
  content?: string;
  isActive: boolean;
}

interface DocumentTabSystemProps {
  tabs: DocumentTab[];
  activeTabId?: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

const DocumentTabSystem: React.FC<DocumentTabSystemProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose
}) => {
  const getFileIcon = (fileName: string) => {
    if (!fileName) return '📄';
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'txt': return '📄';
      case 'xlsx':
      case 'xls': return '📊';
      default: return '📄';
    }
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => onTabClick(tab.id)}
        >
          <span className="tab-icon">
            {tab.fileName ? getFileIcon(tab.fileName) : tab.icon}
          </span>
          <span className="tab-name">{tab.name}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default DocumentTabSystem;
