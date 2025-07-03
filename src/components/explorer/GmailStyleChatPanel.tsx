import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Client } from '@/services/clientService';
import { searchDocuments } from '@/services/searchService';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    document_title: string;
    document_file_name: string;
    pages?: number[];
    excerpts?: Array<{
      page?: number;
      text: string;
      lines?: string;
      section?: string;
      queryRelevance?: number;
    }>;
    document_id?: string;
  }>;
  documentCount?: number;
  query?: string;
}

interface GmailStyleChatPanelProps {
  client: Client | null;
  isOpen: boolean;
  onOpenDocumentWithHighlights?: (document: any, highlights: any[], query: string) => void;
  onToggle: () => void;
}

const GmailStyleChatPanel: React.FC<GmailStyleChatPanelProps> = ({ 
  client, 
  isOpen,
  onOpenDocumentWithHighlights,
  onToggle
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Auto-expanding textarea logic
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setInputValue(textarea.value);
    
    // Reset height to recalculate
    textarea.style.height = 'auto';
    
    // Calculate new height
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 120; // Maximum height in pixels
    const minHeight = 40; // Minimum height in pixels
    
    if (scrollHeight <= maxHeight) {
      textarea.style.height = Math.max(scrollHeight, minHeight) + 'px';
      textarea.style.overflowY = 'hidden';
    } else {
      textarea.style.height = maxHeight + 'px';
      textarea.style.overflowY = 'auto';
    }
  };

  const formatConversationalResponse = useMemo(() => (fullResponse: string) => {
    let response = fullResponse
      .replace(/Based on (?:the )?(?:provided )?documents?,?\s*/gi, '')
      .replace(/According to (?:the )?(?:provided )?documents?,?\s*/gi, '')
      .replace(/Document:\s*[^|]+\|\s*Location:\s*[^|]+\|\s*Lines:\s*[^\n\r.]+/gi, '')
      .replace(/Document:\s*[^|]+\|\s*Page\s*\d+/gi, '')
      .replace(/Section:\s*[^\n\r.]+/gi, '')
      .replace(/\(.*?Chunk \d+.*?\)/gi, '')
      .replace(/\(Document \d+.*?\)/gi, '')
      .replace(/Location:\s*[^\n\r.]+/gi, '')
      .replace(/Lines:\s*[^\n\r.]+/gi, '')
      .replace(/as referenced in.*?,/gi, '')
      .replace(/This information is explicitly stated in.*?\./gi, '')
      .replace(/If you (?:require|need) further details.*?please let me know\.?/gi, '')
      .replace(/Review the highlighted sources.*?specific aspect\??/gi, '')
      .replace(/Would you like me to elaborate.*?\??/gi, '')
      .trim();

    response = response.replace(/\s+/g, ' ').trim();

    if (response.length > 20) {
      const starters = [
        "I found that ",
        "Looking at your documents, ",
        "From what I can see, ",
        "The records show that ",
        "Here's what I discovered: "
      ];
      
      if (!response.match(/^(I |Looking |From |Here's |The documents|The records)/i)) {
        const randomStarter = starters[Math.floor(Math.random() * starters.length)];
        response = randomStarter.toLowerCase() + response;
      }
    }

    return response.charAt(0).toUpperCase() + response.slice(1);
  }, []);

  const handleViewDocument = useCallback((source: any, query: string, aiResponse: string) => {
    console.log('Opening document with highlights:', { source, query, aiResponse });
    
    const highlights = source.excerpts?.map((excerpt: any) => ({
      text: excerpt.text,
      page: excerpt.page,
      lines: excerpt.lines,
      section: excerpt.section,
    })) || [];

    console.log('Formatted highlights:', highlights);

    if (onOpenDocumentWithHighlights && highlights.length > 0) {
      const documentData = {
        id: source.document_id,
        title: source.document_title,
        file_name: source.document_file_name,
        document_title: source.document_title,
        document_file_name: source.document_file_name,
      };
      
      console.log('Calling onOpenDocumentWithHighlights with:', { documentData, highlights, query });
      onOpenDocumentWithHighlights(documentData, highlights, query);
    } else {
      toast({
        title: "Opening document",
        description: `Opening ${source.document_title}`,
      });
      
      if (onOpenDocumentWithHighlights) {
        const documentData = {
          id: source.document_id,
          title: source.document_title,
          file_name: source.document_file_name,
          document_title: source.document_title,
          document_file_name: source.document_file_name,
        };
        onOpenDocumentWithHighlights(documentData, [], query);
      }
    }
  }, [onOpenDocumentWithHighlights, toast]);

  const formatDocumentReference = (source: any) => {
    const fileName = source.document_file_name || source.document_title;
    return fileName;
  };

  // Enhanced citation formatting for legal context
  const formatLegalCitation = (excerpt: any, source: any) => {
    const docName = source.document_title || source.document_file_name;
    const pageRef = excerpt.page ? `Page ${excerpt.page}` : '';
    const lineRef = excerpt.lines ? `Lines ${excerpt.lines}` : '';
    const location = [pageRef, lineRef].filter(Boolean).join(', ');
    
    // Determine document type and add appropriate icon
    const getDocIcon = (docName: string) => {
      const name = docName.toLowerCase();
      if (name.includes('contract') || name.includes('agreement')) return '📋';
      if (name.includes('memo') || name.includes('legal')) return '📝';
      if (name.includes('petition') || name.includes('filing')) return '⚖️';
      if (name.includes('correspondence') || name.includes('email')) return '📧';
      return '📄';
    };
    
    return {
      docName,
      location,
      icon: getDocIcon(docName),
      fullCitation: location ? `${docName} (${location})` : docName
    };
  };

  const formatAIResponse = useCallback((content: string, sources: any[], documentCount: number, query: string) => {
    const formattedContent = formatConversationalResponse(content);
    
    const relevantSources = sources?.filter(source => {
      return source.excerpts && source.excerpts.length > 0;
    }) || [];
    
    return (
      <div className="space-y-3">
        <div className="text-sm leading-relaxed text-gray-800">
          {formattedContent}
        </div>

        {relevantSources && relevantSources.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-gray-600 mb-2">
              References:
            </div>

            {relevantSources.map((source, sourceIndex) => (
              <div key={sourceIndex} className="space-y-1">
                {source.excerpts && source.excerpts.map((excerpt: any, excerptIndex: number) => {
                  // Determine relevance color based on queryRelevance score
                  const relevanceScore = excerpt.queryRelevance || 0;
                  const bgColor = relevanceScore > 0.6 ? 'bg-green-50' : relevanceScore > 0.3 ? 'bg-yellow-50' : 'bg-gray-50';
                  const borderColor = relevanceScore > 0.6 ? 'border-green-300' : relevanceScore > 0.3 ? 'border-yellow-300' : 'border-gray-300';
                  
                  const citation = formatLegalCitation(excerpt, source);
                  const displayText = excerpt.highlightedText || excerpt.text;
                  const isLong = displayText.length > 120;
                  
                  return (
                  <div key={excerptIndex} className={`${bgColor} border-l-2 ${borderColor} p-3 rounded-r text-xs`}>
                    <button
                      onClick={() => handleViewDocument(source, query, content)}
                      className="w-full text-left hover:bg-yellow-100 rounded p-1 -m-1 transition-colors"
                    >
                      {/* Enhanced document header */}
                      <div className="text-gray-700 mb-2 flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="mr-1 text-sm">{citation.icon}</span>
                          <span className="font-medium">{citation.docName}</span>
                        </div>
                        {citation.location && (
                          <span className="text-gray-500 text-xs">{citation.location}</span>
                        )}
                      </div>
                      
                      {/* Quote with better formatting */}
                      <div className="text-blue-700 font-medium leading-relaxed">
                        <span className="text-blue-600">"</span>
                        {isLong ? displayText.substring(0, 120) + '...' : displayText}
                        <span className="text-blue-600">"</span>
                      </div>
                      
                      {/* Legal metadata tags */}
                      {excerpt.legal_metadata && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {excerpt.legal_metadata.legal_concept && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {excerpt.legal_metadata.legal_concept}
                            </span>
                          )}
                          {excerpt.legal_metadata.section && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                              {excerpt.legal_metadata.section}
                            </span>
                          )}
                          {excerpt.legal_metadata.entities && excerpt.legal_metadata.entities.length > 0 && (
                            excerpt.legal_metadata.entities.slice(0, 2).map((entity: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                {entity}
                              </span>
                            ))
                          )}
                        </div>
                      )}
                      
                      {/* Relevance indicator */}
                      {relevanceScore > 0.7 && (
                        <div className="mt-1 text-green-600 text-xs flex items-center">
                          <span className="w-1 h-1 bg-green-500 rounded-full mr-1"></span>
                          High relevance
                        </div>
                      )}
                    </button>
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [formatConversationalResponse, handleViewDocument]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !client || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      query: inputValue.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentQuery = inputValue.trim();
    setInputValue('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }
    
    setIsLoading(true);

    try {
      console.log('Sending search query:', currentQuery, 'for client:', client.name, 'with ID:', client.id);
      const response = await searchDocuments(currentQuery, client.id, client);
      console.log('Search response:', response);
      
      // Better error handling for no results
      if (!response.ai_response && (!response.consolidated_documents || response.consolidated_documents.length === 0)) {
        // Check if this is a simple folder query first
        if (currentQuery.toLowerCase().includes('folder')) {
          // This should be handled by the searchDocuments function already
        }
        
        const fallbackMessage = `I searched ${client.name}'s documents but couldn't find information about "${currentQuery}". 

If you're asking about folders, try: "What folders do I have?"

For document content, make sure documents are uploaded and processed. You can also try:
• "What documents are available?"
• "Show me case details"
• Questions about specific legal terms or case facts`;
        
        const fallbackChatMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: fallbackMessage,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, fallbackChatMessage]);
        setInputValue('');
        return;
      }
      
      // Use consolidated documents directly - spans are already extracted by LLM
      let sources = response.consolidated_documents
        ?.filter(doc => {
          // Only show documents that have excerpts (LLM found relevant spans)
          return doc.excerpts && doc.excerpts.length > 0;
        })
        .slice(0, 3) // Limit to top 3 most relevant documents
        .map((doc, index) => {
          return {
            document_title: doc.document_title,
            document_file_name: doc.document_file_name,
            document_id: doc.document_id,
            excerpts: doc.excerpts.map((excerpt, excerptIndex) => ({
              page: excerpt.page,
              text: excerpt.text, // This is now the LLM-extracted span
              lines: excerpt.lines,
              section: excerpt.section,
              queryRelevance: excerpt.queryRelevance || 1.0,
              legal_metadata: excerpt.legal_metadata,
              originalIndex: excerptIndex,
            })),
          };
        }) || [];

      console.log('Final formatted sources with sentence highlighting:', sources);
      console.log('Raw response from search:', response);
      console.log('Consolidated documents:', response.consolidated_documents);
      
      // Debug: Check if we have any excerpts at all
      if (response.consolidated_documents) {
        response.consolidated_documents.forEach((doc, i) => {
          console.log(`Document ${i + 1}:`, doc.document_title);
          console.log(`Excerpts count:`, doc.excerpts?.length || 0);
          if (doc.excerpts) {
            doc.excerpts.forEach((excerpt, j) => {
              console.log(`  Excerpt ${j + 1} text:`, excerpt.text);
              console.log(`  Excerpt ${j + 1} relevance:`, excerpt.queryRelevance);
            });
          }
        });
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.ai_response || 'I couldn\'t find relevant information in your documents.',
        timestamp: new Date(),
        sources,
        documentCount: response.results?.length || 0,
        query: currentQuery,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredMessages = useMemo(() => 
    messages.filter(msg => msg.content && msg.content.trim() !== ''),
    [messages]
  );

  if (!client) {
    return null;
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Messages Area - Use calc to reserve space for input */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="p-4 pb-6">
          <div className="space-y-4">
            {filteredMessages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">Start a conversation about {client.name}'s case</p>
                <p className="text-sm">Ask questions about documents, deadlines, or case details</p>
                <p className="text-xs mt-2 text-gray-400">
                  Try: "What folders do I have?" or "What were the ages of the two minors?"
                </p>
              </div>
            )}
            
            {filteredMessages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <Card className={`max-w-[90%] p-4 ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100'
                }`}>
                  {message.role === 'assistant' && message.sources ? (
                    formatAIResponse(message.content, message.sources, message.documentCount || 0, message.query || '')
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  )}
                  
                  <div className="text-xs opacity-70 mt-3 pt-2 border-t border-gray-200">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </Card>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <Card className="max-w-[80%] p-3 bg-gray-100">
                  <div className="flex items-center text-sm text-gray-600">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    I'm looking through {client.name}'s documents...
                  </div>
                </Card>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed height at bottom */}
      <div className="border-t bg-white p-4 flex-shrink-0" style={{ height: '90px', minHeight: '90px' }}>
        <div className="flex gap-2 items-center h-full">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder={`Search ${client.name}'s documents...`}
            disabled={isLoading}
            className="flex-1 resize-none"
            rows={1}
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GmailStyleChatPanel;
