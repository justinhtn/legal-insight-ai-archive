
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, FileText, Lightbulb } from 'lucide-react';
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
}

interface TabbedDocumentViewerProps {
  tabs: DocumentTabData[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onShowOverview: () => void;
  showOverview: boolean;
}

const TabbedDocumentViewer: React.FC<TabbedDocumentViewerProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onShowOverview,
  showOverview
}) => {
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tab Bar */}
      <div className="flex items-center bg-gray-100 border-b overflow-x-auto">
        {/* Overview Tab */}
        <Button
          variant={showOverview ? "default" : "ghost"}
          size="sm"
          onClick={onShowOverview}
          className="flex-shrink-0 rounded-none border-r"
        >
          Overview
        </Button>

        {/* Document Tabs */}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center border-r ${
              activeTabId === tab.id ? 'bg-white' : 'bg-gray-100'
            }`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className="flex items-center gap-2 rounded-none px-3 py-2"
            >
              <FileText className="h-4 w-4" />
              <span className="max-w-32 truncate">{tab.title}</span>
              <div title="Has highlights">
                <Lightbulb className="h-3 w-3 text-yellow-500" />
              </div>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTabClose(tab.id)}
              className="p-1 h-8 w-8 rounded-none hover:bg-red-100"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1">
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
