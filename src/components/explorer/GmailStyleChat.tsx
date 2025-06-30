
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
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
    }>;
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

  const handleViewDocument = (source: any, query: string) => {
    const highlights = source.excerpts?.map((excerpt: any) => ({
      text: excerpt.text,
      page: excerpt.page,
      lines: excerpt.lines,
    })) || [];

    if (onOpenDocumentWithHighlights) {
      onOpenDocumentWithHighlights(source, highlights, query);
    }
  };

  const getConciseResponse = (fullResponse: string) => {
    // Remove boilerplate phrases
    let response = fullResponse
      .replace(/If you require further details.*?please let me know\./gi, '')
      .replace(/Review the highlighted sources.*?specific aspect\?/gi, '')
      .replace(/Would you like me to elaborate.*?\?/gi, '')
      .replace(/This information is explicitly stated in.*?\./gi, '')
      .replace(/as referenced in.*?,/gi, '')
      .replace(/\(.*?Chunk \d+.*?\)/gi, '')
      .replace(/\(Document \d+.*?\)/gi, '')
      .trim();

    // Split into sentences and take first 1-2 sentences for simple questions
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // For very short answers (like numbers, dates), return as is
    if (response.length < 50) {
      return response;
    }
    
    // For longer responses, limit to 2 sentences max
    return sentences.slice(0, 2).join('. ').trim() + (sentences.length > 2 ? '.' : '');
  };

  const formatAIResponse = (content: string, sources: any[], documentCount: number, query: string) => {
    const conciseContent = getConciseResponse(content);
    
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

        {sources && sources.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-gray-700">
              <span>📚</span>
              <span>Key Sources</span>
            </div>

            {sources.map((source, sourceIndex) => (
              <div key={sourceIndex} className="border-l-4 border-gray-200 pl-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <button
                    onClick={() => handleViewDocument(source, query)}
                    className="font-medium text-blue-600 hover:text-blue-800 underline text-left"
                  >
                    {source.document_title}
                  </button>
                </div>
                
                {source.excerpts && source.excerpts.length > 0 && (
                  <div className="space-y-1 text-xs ml-6">
                    {source.excerpts.slice(0, 2).map((excerpt: any, excerptIndex: number) => (
                      <div key={excerptIndex} className="text-gray-700">
                        <button
                          onClick={() => handleViewDocument(source, query)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                        >
                          • "{excerpt.text.length > 80 ? excerpt.text.substring(0, 80) + '...' : excerpt.text}"
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
    setIsLoading(true);

    try {
      const response = await searchDocuments(currentQuery, client.id);
      
      const sources = response.consolidated_documents?.slice(0, 3).map(doc => {
        return {
          document_title: doc.document_title,
          document_file_name: doc.document_file_name,
          excerpts: doc.excerpts.map(excerpt => ({
            page: excerpt.page,
            text: excerpt.text,
            lines: excerpt.lines,
          })),
        };
      });

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
            {messages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">Start a conversation about {client.name}'s case</p>
                <p className="text-sm">Ask questions about documents, deadlines, or case details</p>
              </div>
            )}
            
            {messages.map((message) => (
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
                    AI is analyzing documents...
                  </div>
                </Card>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>
      </div>

      {/* Input - Fixed at bottom */}
      <div className="p-4 border-t bg-white flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Ask about ${client.name}'s documents...`}
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GmailStyleChat;
