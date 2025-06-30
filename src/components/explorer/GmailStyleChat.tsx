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
}

const GmailStyleChat: React.FC<GmailStyleChatProps> = ({ 
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

  // Load chat history when client changes
  useEffect(() => {
    if (client) {
      loadChatHistory();
    } else {
      setMessages([]);
    }
  }, [client?.id]);

  const loadChatHistory = () => {
    // In real implementation, load from storage/database
    setMessages([]);
  };

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

  // Filter sources to only show documents actually referenced by AI
  const filterRelevantSources = (sources: any[], aiResponse: string) => {
    if (!sources || sources.length === 0) return sources;
    
    return sources.filter(source => {
      const fileName = source.document_file_name || source.document_title;
      const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
      
      // Check if AI response contains reference to this specific document
      const aiLower = aiResponse.toLowerCase();
      const fileNameLower = fileName.toLowerCase();
      const fileNameNoExtLower = fileNameWithoutExt.toLowerCase();
      
      // Look for exact mentions of the document name
      return aiLower.includes(fileNameLower) || 
             aiLower.includes(fileNameNoExtLower) ||
             // Also check if any excerpts from this document are directly quoted
             source.excerpts?.some((excerpt: any) => 
               aiLower.includes(excerpt.text.toLowerCase().substring(0, 50))
             );
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

  const getConciseResponse = (fullResponse: string) => {
    // Remove boilerplate phrases more aggressively
    let response = fullResponse
      .replace(/If you (?:require|need) further details.*?please let me know\.?/gi, '')
      .replace(/Review the highlighted sources.*?specific aspect\??/gi, '')
      .replace(/Would you like me to elaborate.*?\??/gi, '')
      .replace(/This information is explicitly stated in.*?\./gi, '')
      .replace(/as referenced in.*?,/gi, '')
      .replace(/\(.*?Chunk \d+.*?\)/gi, '')
      .replace(/\(Document \d+.*?\)/gi, '')
      .replace(/Based on the provided documents?,?/gi, '')
      .replace(/According to the document(?:s|ation)?,?/gi, '')
      .trim();

    // Split into sentences and clean up
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // For very short answers (like numbers, dates), return as is
    if (response.length < 50) {
      return response;
    }
    
    // For longer responses, limit to 2-3 sentences max for conciseness
    const maxSentences = response.includes('•') || response.includes('-') ? 5 : 2;
    return sentences.slice(0, maxSentences).join('. ').trim() + (sentences.length > maxSentences ? '.' : '');
  };

  const formatDocumentReference = (source: any) => {
    const fileName = source.document_file_name || source.document_title;
    let reference = `${fileName}`;
    
    if (source.excerpts && source.excerpts.length > 0) {
      const excerpt = source.excerpts[0];
      if (excerpt.section) {
        reference += ` | ${excerpt.section}`;
      }
      if (excerpt.lines) {
        reference += ` | Lines: ${excerpt.lines}`;
      } else if (excerpt.page) {
        reference += ` | Page: ${excerpt.page}`;
      }
    }
    
    return reference;
  };

  const formatAIResponse = (content: string, sources: any[], documentCount: number, query: string) => {
    const conciseContent = getConciseResponse(content);
    
    // Filter sources to only show documents actually referenced by AI
    const relevantSources = filterRelevantSources(sources, content);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-600 font-semibold">
          <span>🤖</span>
          <span>AI Analysis</span>
        </div>
        
        {documentCount > 0 && (
          <div className="text-xs text-gray-500 mb-3">
            Based on {documentCount} document section{documentCount > 1 ? 's' : ''}
          </div>
        )}

        <div className="text-sm leading-relaxed">
          {conciseContent}
        </div>

        {relevantSources && relevantSources.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-gray-700">
              <span>📚</span>
              <span>Key Sources ({relevantSources.length})</span>
            </div>

            {relevantSources.map((source, sourceIndex) => (
              <div key={sourceIndex} className="border-l-4 border-gray-200 pl-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <button
                    onClick={() => handleViewDocument(source, query, content)}
                    className="font-medium text-blue-600 hover:text-blue-800 underline text-left text-sm"
                  >
                    {formatDocumentReference(source)}
                  </button>
                </div>
                
                {source.excerpts && source.excerpts.length > 0 && (
                  <div className="space-y-1 text-xs ml-6">
                    {source.excerpts
                      .filter((excerpt: any) => excerpt.queryRelevance === undefined || excerpt.queryRelevance > 0.1)
                      .slice(0, 3)
                      .map((excerpt: any, excerptIndex: number) => (
                      <div key={excerptIndex} className="text-gray-700 bg-yellow-50 p-2 rounded border-l-2 border-yellow-300">
                        <div className="font-medium text-xs text-gray-600 mb-1">
                          {excerpt.page && `Page ${excerpt.page}`}
                          {excerpt.lines && ` • Lines ${excerpt.lines}`}
                          {excerpt.section && ` • ${excerpt.section}`}
                          {excerpt.queryRelevance && ` • Match: ${Math.round(excerpt.queryRelevance * 100)}%`}
                        </div>
                        <button
                          onClick={() => handleViewDocument(source, query, content)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                        >
                          "{excerpt.text.length > 120 ? excerpt.text.substring(0, 120) + '...' : excerpt.text}"
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

    setMessages(prev => [...prev, userMessage]);
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
      
      const sources = response.consolidated_documents?.slice(0, 3).map(doc => {
        return {
          document_title: doc.document_title,
          document_file_name: doc.document_file_name,
          document_id: doc.document_id,
          excerpts: doc.excerpts.map(excerpt => ({
            page: excerpt.page,
            text: excerpt.text,
            lines: excerpt.lines,
            section: excerpt.section,
            queryRelevance: excerpt.queryRelevance,
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
