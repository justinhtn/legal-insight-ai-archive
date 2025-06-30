
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Search, ChevronUp, ChevronDown } from 'lucide-react';

interface DocumentHighlight {
  text: string;
  page?: number;
  lines?: string;
  section?: string;
}

interface DocumentTabProps {
  documentTitle: string;
  documentContent: string;
  highlights: DocumentHighlight[];
  query: string;
  onClose: () => void;
}

const DocumentTab: React.FC<DocumentTabProps> = ({
  documentTitle,
  documentContent,
  highlights,
  query,
  onClose
}) => {
  const [highlightedContent, setHighlightedContent] = useState('');
  const [currentHighlight, setCurrentHighlight] = useState(0);

  useEffect(() => {
    if (highlights.length > 0) {
      console.log('Processing highlights for document:', highlights);
      let content = documentContent;
      
      // Sort highlights by relevance (longer text first, then by page/line)
      const sortedHighlights = [...highlights].sort((a, b) => {
        if (a.text.length !== b.text.length) {
          return b.text.length - a.text.length;
        }
        if (a.page && b.page) {
          return a.page - b.page;
        }
        return 0;
      });
      
      // Apply highlights in order
      sortedHighlights.forEach((highlight, index) => {
        const escapedText = highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedText})`, 'gi');
        content = content.replace(regex, `<span id="highlight-${index}" class="bg-yellow-200 px-1 rounded font-medium">\$1</span>`);
      });
      
      setHighlightedContent(content);
    } else {
      setHighlightedContent(documentContent);
    }
  }, [documentContent, highlights]);

  const scrollToHighlight = (index: number) => {
    const element = document.getElementById(`highlight-${index}`);
    if (element) {
      // Remove previous highlight focus
      document.querySelectorAll('.bg-yellow-400').forEach(el => {
        el.classList.remove('bg-yellow-400');
        el.classList.add('bg-yellow-200');
      });
      
      // Add current highlight focus
      element.classList.remove('bg-yellow-200');
      element.classList.add('bg-yellow-400');
      
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

  useEffect(() => {
    // Auto-scroll to first highlight when component mounts
    if (highlights.length > 0) {
      setTimeout(() => scrollToHighlight(0), 100);
    }
  }, [highlights]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {documentTitle}
            </h2>
            {query && (
              <p className="text-sm text-gray-600 mt-1">
                Query: "{query}"
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="ml-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Highlight Navigation */}
        {highlights.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <Search className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Highlight {currentHighlight + 1} of {highlights.length}
            </span>
            <div className="flex gap-1 ml-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevHighlight}
                disabled={highlights.length <= 1}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={nextHighlight}
                disabled={highlights.length <= 1}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            <div 
              className="prose prose-sm max-w-none font-mono text-sm leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: highlightedContent }}
            />
          </div>
        </ScrollArea>
      </div>

      {/* Highlights Sidebar - if there are highlights */}
      {highlights.length > 0 && (
        <div className="border-t bg-gray-50 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Highlights ({highlights.length})</h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {highlights.map((highlight, index) => (
              <button
                key={index}
                onClick={() => scrollToHighlight(index)}
                className={`w-full text-left p-2 rounded text-xs border transition-colors ${
                  currentHighlight === index 
                    ? 'bg-yellow-100 border-yellow-300' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-gray-700 mb-1">
                  {highlight.page && `Page ${highlight.page}`}
                  {highlight.lines && ` • Lines ${highlight.lines}`}
                  {highlight.section && ` • ${highlight.section}`}
                </div>
                <div className="text-gray-600 line-clamp-2">
                  "{highlight.text.substring(0, 100)}{highlight.text.length > 100 ? '...' : ''}"
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentTab;
