
import React from 'react';
import { FileText } from 'lucide-react';
import DocumentTab from './DocumentTab';

interface DocumentTabData {
  id: string;
  title: string;
  content: string;
  highlights: Array<{
    text: string;
    page?: number;
    lines?: string;
  }>;
  query: string;
  documentId: string;
}

interface TabbedDocumentViewerProps {
  tabs: DocumentTabData[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onShowOverview: () => void;
  showOverview: boolean;
  showTabsOnly?: boolean;
}

const TabbedDocumentViewer: React.FC<TabbedDocumentViewerProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onShowOverview,
  showOverview,
  showTabsOnly = false
}) => {
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // If only showing tabs, return just empty div (tabs are handled by parent)
  if (showTabsOnly) {
    return <div />;
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Content Area - No duplicate tabs here */}
      <div className="flex-1 overflow-auto">
        {showOverview ? (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Document Overview
              </h3>
              <p className="text-gray-600 mb-4">
                Browse files and folders, or click "View Document with Highlights" in chat to open documents with context.
              </p>
              {tabs.length > 0 && (
                <p className="text-sm text-gray-500">
                  {tabs.length} document{tabs.length === 1 ? '' : 's'} open with highlights
                </p>
              )}
            </div>
          </div>
        ) : activeTab ? (
          <DocumentTab
            documentTitle={activeTab.title}
            documentContent={activeTab.content}
            highlights={activeTab.highlights}
            query={activeTab.query}
            onClose={() => onTabClose(activeTab.id)}
            documentId={activeTab.documentId}
            enableCollaborative={true}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <p>No document selected</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TabbedDocumentViewer;
