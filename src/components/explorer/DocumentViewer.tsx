
import React, { useEffect, useState } from 'react';
import { getDocumentContent } from '@/services/documentContentService';

interface DocumentViewerProps {
  documentId?: string;
  fileName?: string;
  content?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  documentId, 
  fileName,
  content: initialContent 
}) => {
  const [content, setContent] = useState<string>(initialContent || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentId && !initialContent) {
      setLoading(true);
      setError(null);
      
      getDocumentContent(documentId)
        .then(setContent)
        .catch((err) => {
          setError(`Failed to load document: ${err.message}`);
          setContent('');
        })
        .finally(() => setLoading(false));
    }
  }, [documentId, initialContent]);

  if (loading) {
    return (
      <div className="document-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading document...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!content && !loading) {
    return (
      <div className="document-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-gray-400 text-4xl mb-4">📄</div>
            <p className="text-gray-600">Document content not available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-area">
      {fileName && (
        <div className="document-header">
          <div>
            <div className="document-title">{fileName}</div>
            <div className="document-meta">
              {content.length > 0 && `${content.length} characters`}
            </div>
          </div>
        </div>
      )}
      
      <div className="document-content">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
          {content}
        </pre>
      </div>
    </div>
  );
};

export default DocumentViewer;
