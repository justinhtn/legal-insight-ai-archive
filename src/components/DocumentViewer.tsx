import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';

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

  const highlightText = (text: string, highlights: Highlight[]) => {
    let highlightedText = text;
    
    highlights.forEach((highlight, index) => {
      const regex = new RegExp(highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      highlightedText = highlightedText.replace(
        regex,
        `<mark id="highlight-${index}" style="background-color: ${index === currentHighlight ? '#ffc107' : '#fff3cd'}; padding: 2px 4px; border-radius: 3px;">${highlight.text}</mark>`
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

  // CRITICAL: Use fixed positioning to bypass parent containers
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'white',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 4px 0' }}>{documentTitle}</h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Query: "{query}"</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>
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
              onClick={() => window.close()}
            >
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* CRITICAL: Document Content with explicit height and overflow */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
        height: 'calc(100vh - 100px)' // Explicit height calculation
      }}>
        <div 
          style={{
            fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
            fontSize: '14px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}
          dangerouslySetInnerHTML={{ 
            __html: highlightText(documentContent, highlights) 
          }}
        />
      </div>
    </div>
  );
};

export default DocumentViewer;