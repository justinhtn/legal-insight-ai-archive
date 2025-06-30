
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface Highlight {
  text: string;
  page?: number;
  lines?: string;
  section?: string;
}

const DocumentViewer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [currentHighlight, setCurrentHighlight] = useState(0);
  
  const title = searchParams.get('title') || 'Document';
  const content = searchParams.get('content') || 'Loading document content...';
  const query = searchParams.get('query') || '';
  
  let highlights: Highlight[] = [];
  try {
    const highlightsParam = searchParams.get('highlights');
    if (highlightsParam) {
      highlights = JSON.parse(highlightsParam);
    }
  } catch (error) {
    console.error('Error parsing highlights:', error);
  }

  const [highlightedContent, setHighlightedContent] = useState('');

  useEffect(() => {
    if (highlights.length > 0) {
      let processedContent = content;
      
      // Sort highlights by length (longer first to avoid conflicts)
      const sortedHighlights = [...highlights].sort((a, b) => b.text.length - a.text.length);
      
      // Apply highlights
      sortedHighlights.forEach((highlight, index) => {
        const escapedText = highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedText})`, 'gi');
        processedContent = processedContent.replace(
          regex, 
          `<span id="highlight-${index}" class="bg-yellow-200 px-1 rounded font-medium">\$1</span>`
        );
      });
      
      setHighlightedContent(processedContent);
    } else {
      setHighlightedContent(content);
    }
  }, [content, highlights]);

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
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900 truncate">
              {title}
            </h1>
            {query && (
              <p className="text-sm text-gray-600 mt-1">
                Query: "{query}"
              </p>
            )}
          </div>
          
          {highlights.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-gray-600">
                Highlight {currentHighlight + 1} of {highlights.length}
              </span>
              <div className="flex gap-1">
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
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.close()}
            className="ml-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
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

      {/* Highlights Sidebar */}
      {highlights.length > 0 && (
        <div className="border-t bg-gray-50 p-4 max-h-48 overflow-hidden">
          <h3 className="font-medium text-gray-900 mb-3">Highlights ({highlights.length})</h3>
          <ScrollArea className="h-32">
            <div className="space-y-2">
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
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
