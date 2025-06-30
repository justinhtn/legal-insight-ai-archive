
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, X, FileText, Lightbulb } from 'lucide-react';

interface Highlight {
  text: string;
  page?: number;
  lines?: string;
}

interface DocumentTabProps {
  documentTitle: string;
  documentContent: string;
  highlights: Highlight[];
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
  const [currentHighlight, setCurrentHighlight] = useState(0);
  const [showHighlights, setShowHighlights] = useState(true);

  useEffect(() => {
    // Auto-fade highlights after 30 seconds
    const timer = setTimeout(() => {
      setShowHighlights(false);
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  const highlightText = (text: string, highlights: Highlight[]) => {
    if (!showHighlights) return text;
    
    let highlightedText = text;
    
    highlights.forEach((highlight, index) => {
      const regex = new RegExp(highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      highlightedText = highlightedText.replace(
        regex,
        `<mark id="highlight-${index}" class="bg-yellow-200 px-1 rounded transition-all duration-300">${highlight.text}</mark>`
      );
    });
    
    return highlightedText;
  };

  const scrollToHighlight = (index: number) => {
    const element = document.getElementById(`highlight-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setCurrentHighlight(index);
      
      // Remove previous current highlight
      document.querySelectorAll('.bg-yellow-400').forEach(el => {
        el.classList.remove('bg-yellow-400');
        el.classList.add('bg-yellow-200');
      });
      
      // Add current highlight
      element.classList.remove('bg-yellow-200');
      element.classList.add('bg-yellow-400');
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

  const toggleHighlights = () => {
    setShowHighlights(!showHighlights);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            <span className="font-semibold text-gray-900">{documentTitle}</span>
            <div title="Opened with highlights">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="mt-2 text-sm text-gray-600">
          Query: "{query}"
        </div>
        
        {highlights.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
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
              onClick={toggleHighlights}
              className={showHighlights ? 'bg-yellow-100' : ''}
            >
              {showHighlights ? 'Hide' : 'Show'} Highlights
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex">
        {/* Document Content */}
        <div className="flex-1">
          <ScrollArea className="h-full p-6">
            <div 
              className="prose max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: highlightText(documentContent, highlights) 
              }}
            />
          </ScrollArea>
        </div>

        {/* Highlights Sidebar */}
        {showHighlights && highlights.length > 0 && (
          <div className="w-80 border-l bg-gray-50">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Highlights ({highlights.length})</h3>
              <p className="text-xs text-gray-500 mt-1">Related to: "{query}"</p>
            </div>
            <ScrollArea className="h-full p-4">
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
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentTab;
