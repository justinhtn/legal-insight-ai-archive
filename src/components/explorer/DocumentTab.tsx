import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ChevronUp, ChevronDown, X, Edit3 } from 'lucide-react';
import CollaborativeDocumentTab from '../collaborative/CollaborativeDocumentTab';
import { supabase } from '@/integrations/supabase/client';

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
  documentId?: string;
  enableCollaborative?: boolean;
}

const DocumentTab: React.FC<DocumentTabProps> = ({
  documentTitle,
  documentContent,
  highlights,
  query,
  onClose,
  documentId,
  enableCollaborative = false
}) => {
  const [highlightedContent, setHighlightedContent] = useState('');
  const [currentHighlight, setCurrentHighlight] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'view' | 'collaborate'>('view');
  const [currentContent, setCurrentContent] = useState(documentContent);

  // Get current user for collaborative features
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    
    if (enableCollaborative) {
      getCurrentUser();
    }
  }, [enableCollaborative]);

  // Sync initial content
  useEffect(() => {
    setCurrentContent(documentContent);
  }, [documentContent]);

  // Fetch latest content when switching to view mode
  const fetchLatestContent = async () => {
    if (documentId) {
      try {
        console.log('Fetching latest content for document:', documentId);
        
        // Add a small delay to ensure the save has completed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data, error } = await supabase
          .from('documents')
          .select('content')
          .eq('id', documentId)
          .single();
        
        if (error) throw error;
        if (data?.content) {
          console.log('Fetched content length:', data.content.length);
          console.log('Current content length:', currentContent.length);
          
          if (data.content !== currentContent) {
            console.log('Content has changed, updating view');
            setCurrentContent(data.content);
          } else {
            console.log('Content is the same');
          }
        }
      } catch (error) {
        console.error('Error fetching latest content:', error);
      }
    }
  };

  // Fetch latest content when switching to view mode
  useEffect(() => {
    if (viewMode === 'view' && documentId) {
      fetchLatestContent();
    }
  }, [viewMode, documentId]);

  useEffect(() => {
    console.log('Processing content for highlights. Current content length:', currentContent.length);
    if (highlights.length > 0) {
      console.log('Processing highlights for document:', highlights);
      let content = currentContent;
      
      // DON'T sort highlights - keep them in original order to maintain index consistency
      highlights.forEach((highlight, index) => {
        const escapedText = highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedText})`, 'gi');
        content = content.replace(regex, `<span id="highlight-${index}" class="bg-yellow-200 px-1 rounded font-medium">\$1</span>`);
      });
      
      setHighlightedContent(content);
      console.log('Set highlighted content length:', content.length);
    } else {
      setHighlightedContent(currentContent);
      console.log('Set plain content length:', currentContent.length);
    }
  }, [currentContent, highlights]);

  const scrollToHighlight = useCallback((index: number) => {
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
  }, []);

  const nextHighlight = useCallback(() => {
    if (highlights.length === 0) return;
    const next = (currentHighlight + 1) % highlights.length;
    scrollToHighlight(next);
  }, [currentHighlight, highlights.length, scrollToHighlight]);

  const prevHighlight = useCallback(() => {
    if (highlights.length === 0) return;
    const prev = currentHighlight === 0 ? highlights.length - 1 : currentHighlight - 1;
    scrollToHighlight(prev);
  }, [currentHighlight, highlights.length, scrollToHighlight]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' && event.ctrlKey) {
        event.preventDefault();
        prevHighlight();
      } else if (event.key === 'ArrowDown' && event.ctrlKey) {
        event.preventDefault();
        nextHighlight();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [nextHighlight, prevHighlight]);

  useEffect(() => {
    // Auto-scroll to first highlight when component mounts
    if (highlights.length > 0) {
      setTimeout(() => scrollToHighlight(0), 100);
    }
  }, [highlights, scrollToHighlight]);

  // Debug logging
  console.log('DocumentTab render:', {
    enableCollaborative,
    documentId,
    hasCurrentUser: !!currentUser,
    viewMode,
    shouldShowCollaborative: enableCollaborative && documentId && currentUser && viewMode === 'collaborate'
  });

  // If collaborative editing is enabled and we have the necessary data, show collaborative component
  if (enableCollaborative && documentId && currentUser && viewMode === 'collaborate') {
    console.log('Rendering CollaborativeDocumentTab');
    return (
      <CollaborativeDocumentTab
        document={{
          id: documentId,
          title: documentTitle,
          content: documentContent,
          highlights,
          query
        }}
        currentUser={{
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.user_metadata?.name
        }}
        onClose={onClose}
        onDocumentUpdate={(content) => {
          console.log('DocumentTab: Document updated callback received:', content?.substring(0, 100) + '...');
          setCurrentContent(content);
        }}
      />
    );
  }

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

          {/* Collaborative mode toggle */}
          {enableCollaborative && documentId && currentUser && (
            <div className="flex items-center gap-2 mr-4">
              <Button
                variant={viewMode === 'view' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  console.log('View button clicked, current content length:', currentContent.length);
                  setViewMode('view');
                }}
              >
                <Search className="h-3 w-3 mr-1" />
                View
              </Button>
              <Button
                variant={viewMode === 'collaborate' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  console.log('Edit button clicked, setting viewMode to collaborate');
                  setViewMode('collaborate');
                }}
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
          )}

          <Button
            variant="outline"
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
                type="button"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={nextHighlight}
                disabled={highlights.length <= 1}
                type="button"
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

      {/* Compact Highlights Sidebar */}
      {highlights.length > 0 && (
        <div className="border-t bg-gray-50 p-3">
          <h3 className="font-medium text-gray-900 mb-2 text-sm">Highlights ({highlights.length})</h3>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {highlights.map((highlight, index) => (
              <button
                key={index}
                onClick={() => scrollToHighlight(index)}
                type="button"
                className={`w-full text-left p-2 rounded text-xs border transition-colors ${
                  currentHighlight === index 
                    ? 'bg-yellow-100 border-yellow-300' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-gray-700 mb-1">
                  {highlight.page && `Page ${highlight.page}`}
                  {highlight.lines && ` • Lines ${highlight.lines}`}
                </div>
                <div className="text-gray-600 line-clamp-1">
                  "{highlight.text.substring(0, 80)}{highlight.text.length > 80 ? '...' : ''}"
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