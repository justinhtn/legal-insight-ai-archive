import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface Highlight {
  text: string;
  page?: number;
  lines?: string;
}

interface DocumentViewerProps {
  documentTitle: string;
  documentContent: string;
  highlights: Highlight[];
  query: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentTitle,
  documentContent,
  highlights,
  query
}) => {
  const [currentHighlight, setCurrentHighlight] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);

  const highlightText = (text: string, highlights: Highlight[]) => {
    let highlightedText = text;
    
    highlights.forEach((highlight, index) => {
      const regex = new RegExp(highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      highlightedText = highlightedText.replace(
        regex,
        `<mark id="highlight-${index}" class="${index === currentHighlight ? 'current' : ''}">${highlight.text}</mark>`
      );
    });
    
    return highlightedText;
  };

  const scrollToHighlight = (index: number) => {
    const element = document.getElementById(`highlight-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setCurrentHighlight(index);
      
      // Update highlight styling
      document.querySelectorAll('mark').forEach((mark, i) => {
        mark.className = i === index ? 'current' : '';
      });
    }
  };

  const nextHighlight = () => {
    const next = (currentHighlight + 1) % highlights.length;
    scrollToHighlight(next);
  };

  const prevHighlight = () => {
    const prev = currentHighlight === 0 ? highlights.length - 1 : currentHighlight - 1;
    scrollToHighlight(prev);
  };

  useEffect(() => {
    if (highlights.length > 0) {
      setTimeout(() => scrollToHighlight(0), 100);
    }
  }, [highlights]);

  return (
    <div className="document-viewer">
      {/* Main Document Content */}
      <div className="document-viewer-main">
        {/* Header */}
        <div className="document-viewer-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{documentTitle}</h1>
              <p className="text-sm text-gray-600">Query: "{query}"</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Highlight {currentHighlight + 1} of {highlights.length}
              </span>
              <Button size="sm" variant="outline" onClick={prevHighlight}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={nextHighlight}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowSidebar(!showSidebar)}
              >
                {showSidebar ? 'Hide' : 'Show'} Highlights
              </Button>
            </div>
          </div>
        </div>

        {/* Document Content - Uses CSS class for proper scrolling */}
        <div className="document-viewer-content">
          <div 
            className="document-text"
            dangerouslySetInnerHTML={{ 
              __html: highlightText(documentContent, highlights) 
            }}
          />
        </div>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div className="document-viewer-sidebar">
          <div className="document-viewer-sidebar-header">
            <h3 className="font-semibold text-gray-900">Highlights ({highlights.length})</h3>
          </div>
          <div className="document-viewer-sidebar-content">
            <div className="space-y-2">
              {highlights.map((highlight, index) => (
                <Card
                  key={index}
                  className={`p-3 cursor-pointer transition-colors ${
                    currentHighlight === index ? 'bg-yellow-100 border-yellow-300' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => scrollToHighlight(index)}
                >
                  <div className="text-sm">
                    <div className="font-medium text-gray-900 mb-1">
                      {highlight.page && `Page ${highlight.page}`}
                      {highlight.lines && ` • ${highlight.lines}`}
                    </div>
                    <div className="text-gray-700 line-clamp-3">
                      "{highlight.text}"
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;