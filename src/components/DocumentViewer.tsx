import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        `<mark id="highlight-${index}" class="bg-yellow-200 px-1 rounded">${highlight.text}</mark>`
      );
    });
    
    return highlightedText;
  };

  const scrollToHighlight = (index: number) => {
    const element = document.getElementById(`highlight-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setCurrentHighlight(index);
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

  return (
    <div className="h-full flex bg-white">
      {/* Main Document Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b bg-gray-50">
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
              <Button size="sm" variant="outline" onClick={() => window.close()}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Document Content - FIXED SCROLLING */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              <div 
                className="prose max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: highlightText(documentContent, highlights) 
                }}
              />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div className="w-80 border-l bg-gray-50 flex flex-col">
          <div className="flex-shrink-0 p-4 border-b">
            <h3 className="font-semibold text-gray-900">Highlights ({highlights.length})</h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
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
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;