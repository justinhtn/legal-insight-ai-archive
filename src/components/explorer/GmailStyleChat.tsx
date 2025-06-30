import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2, FileText, X } from 'lucide-react';
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

interface GmailStyleChatProps {
  client: Client | null;
  isOpen: boolean;
  onOpenDocumentWithHighlights?: (document: any, highlights: any[], query: string) => void;
  onToggle: () => void;
  messages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

const GmailStyleChat: React.FC<GmailStyleChatProps> = ({ 
  client, 
  isOpen,
  onOpenDocumentWithHighlights,
  onToggle,
  messages: externalMessages = [],
  onMessagesChange
}) => {
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Use external messages if provided, otherwise use internal state
  const messages = externalMessages.length > 0 ? externalMessages : internalMessages;
  
  // Helper function to update messages correctly based on whether external management is used
  const updateMessages = (newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (onMessagesChange) {
      // External message management
      const finalMessages = typeof newMessages === 'function' ? newMessages(messages) : newMessages;
      onMessagesChange(finalMessages);
    } else {
      // Internal message management
      setInternalMessages(newMessages);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Auto-expanding textarea logic
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setInputValue(e.target.value);
    
    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto';
    
    // Set height based on content
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 200; // Maximum height before scrolling
    
    if (scrollHeight <= maxHeight) {
      textarea.style.height = scrollHeight + 'px';
    } else {
      textarea.style.height = maxHeight + 'px';
      textarea.style.overflowY = 'scroll';
    }
  };

  // Improved filtering to only show documents actually referenced by AI
  const filterRelevantSources = (sources: any[], aiResponse: string, userQuery: string) => {
    if (!sources || sources.length === 0) return sources;
    
    const queryLower = userQuery.toLowerCase();
    const aiLower = aiResponse.toLowerCase();
    
    return sources.filter(source => {
      // First check if any excerpts are actually relevant to the query
      const relevantExcerpts = source.excerpts?.filter((excerpt: any) => {
        const excerptLower = excerpt.text.toLowerCase();
        
        // For age queries, only show excerpts that contain age information
        if (queryLower.includes('age') || queryLower.includes('minor')) {
          return excerptLower.includes('age') || 
                 excerptLower.includes('year') || 
                 excerptLower.includes('old') || 
                 /\b\d+\b/.test(excerpt.text); // Contains numbers
        }
        
        // For other queries, check if AI response references this excerpt
        const excerptWords = excerptLower.split(/\s+/).filter(word => word.length > 3);
        return excerptWords.some(word => aiLower.includes(word));
      });
      
      // Only include the source if it has relevant excerpts
      if (relevantExcerpts && relevantExcerpts.length > 0) {
        source.excerpts = relevantExcerpts.slice(0, 2); // Limit to top 2 most relevant
        return true;
      }
      
      return false;
    });
  };

  const handleViewDocument = (source: any, query: string, aiResponse: string) => {
    console.log('Opening document with highlights:', { source, query, aiResponse });
    
    // Create proper highlights from the excerpts
    const highlights = source.excerpts?.map((excerpt: any) => ({
      text: excerpt.text,
      page: excerpt.page,
      lines: excerpt.lines,
      section: excerpt.section,
    })) || [];

    console.log('Formatted highlights:', highlights);

    if (onOpenDocumentWithHighlights && highlights.length > 0) {
      // Find the document by ID or title
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
      
      // Fallback: open document without highlights
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
  };

  // Format AI response like a professional legal secretary
  const formatLegalSecretaryResponse = (fullResponse: string) => {
    // Remove all technical jargon and metadata
    let response = fullResponse
      .replace(/Based on (?:the )?(?:provided )?documents?,?\s*/gi, '')
      .replace(/According to (?:the )?(?:provided )?documents?,?\s*/gi, '')
      .replace(/Document:\s*[^|]+\|\s*Location:\s*[^|]+\|\s*Lines:\s*[^\n\r.]+/gi, '')
      .replace(/Document:\s*[^|]+\|\s*Page\s*\d+/gi, '')
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

    // Clean up any remaining technical artifacts
    response = response
      .replace(/^\s*[-•]\s*/gm, '') // Remove bullet points at start of lines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // If the response is very short, return as is
    if (response.length < 100) {
      return response;
    }

    // Split into sentences and clean up
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // For longer responses, keep it concise but complete
    const maxSentences = 3;
    const finalResponse = sentences.slice(0, maxSentences).join('. ').trim();
    
    return finalResponse + (finalResponse.endsWith('.') ? '' : '.');
  };

  const formatDocumentReference = (source: any) => {
    const fileName = source.document_file_name || source.document_title;
    return fileName;
  };

  const formatAIResponse = (content: string, sources: any[], documentCount: number, query: string) => {
    const formattedContent = formatLegalSecretaryResponse(content);
    
    // Filter sources to only show documents actually referenced by AI
    const relevantSources = filterRelevantSources(sources, content, query);
    
    return (
      <div className="space-y-3">
        <div className="text-sm leading-relaxed text-gray-800">
          {formattedContent}
        </div>

        {relevantSources && relevantSources.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-gray-600 mb-2">
              Referenced in:
            </div>

            {relevantSources.map((source, sourceIndex) => (
              <div key={sourceIndex} className="space-y-1">
                {source.excerpts && source.excerpts.map((excerpt: any, excerptIndex: number) => (
                  <div key={excerptIndex} className="bg-yellow-50 border-l-2 border-yellow-300 p-2 rounded-r text-xs">
                    <button
                      onClick={() => handleViewDocument(source, query, content)}
                      className="w-full text-left hover:bg-yellow-100 rounded p-1 -m-1"
                    >
                      <div className="text-gray-600 mb-1 flex items-center">
                        <FileText className="h-3 w-3 mr-1" />
                        {formatDocumentReference(source)}
                        {excerpt.page && ` • Page ${excerpt.page}`}
                      </div>
                      <div className="text-blue-700 font-medium">
                        "{excerpt.text.length > 120 ? excerpt.text.substring(0, 120) + '...' : excerpt.text}"
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !client || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    updateMessages(prev => [...prev, userMessage]);
    const currentQuery = inputValue.trim();
    setInputValue('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    setIsLoading(true);

    try {
      console.log('Sending search query:', currentQuery);
      const response = await searchDocuments(currentQuery, client.id, client);
      console.log('Search response:', response);
      
      // Keep sources in original order without sorting
      const sources = response.consolidated_documents?.slice(0, 3).map((doc, index) => {
        return {
          document_title: doc.document_title,
          document_file_name: doc.document_file_name,
          document_id: doc.document_id,
          excerpts: doc.excerpts.map((excerpt, excerptIndex) => ({
            page: excerpt.page,
            text: excerpt.text,
            lines: excerpt.lines,
            section: excerpt.section,
            queryRelevance: excerpt.queryRelevance,
            originalIndex: excerptIndex,
          })),
        };
      });

      console.log('Formatted sources:', sources);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.ai_response || 'I couldn\'t find relevant information in the documents.',
        timestamp: new Date(),
        sources,
        documentCount: response.results?.length || 0,
        query: currentQuery,
      };

      updateMessages(prev => [...prev, assistantMessage]);
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

  // Filter out empty messages to prevent UI issues
  const filteredMessages = messages.filter(msg => 
    msg.content && msg.content.trim() !== ''
  );

  if (!client) {
    return null;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="p-4 border-b bg-gray-50 rounded-t-lg flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <MessageCircle className="mr-2 h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Chat - {client.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages - Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        <ScrollArea className="h-full p-4">
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
                    AI is analyzing {client.name}'s documents...
                  </div>
                </Card>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>
      </div>

      {/* Input - Fixed at bottom with auto-expanding textarea */}
      <div className="p-4 border-t bg-white flex-shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={`Ask about ${client.name}'s documents or folders...`}
            disabled={isLoading}
            className="flex-1 resize-none min-h-[40px] max-h-[200px]"
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

export default GmailStyleChat;
