
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2, FileText, ExternalLink, Minimize2, Maximize2, X } from 'lucide-react';
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

interface FloatingChatPanelProps {
  client: Client | null;
  onOpenDocumentWithHighlights?: (document: any, highlights: any[], query: string) => void;
}

type ChatState = 'minimized' | 'collapsed' | 'expanded';

const FloatingChatPanel: React.FC<FloatingChatPanelProps> = ({ 
  client, 
  onOpenDocumentWithHighlights 
}) => {
  const [chatState, setChatState] = useState<ChatState>('expanded');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [width, setWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatState === 'expanded') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatState]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        if (e.shiftKey) {
          setChatState('minimized');
        } else {
          setChatState(chatState === 'expanded' ? 'collapsed' : 'expanded');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatState]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(300, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/• /g, '• ')
      .replace(/\n/g, '<br/>');
  };

  const formatAIResponse = (content: string, sources: any[], documentCount: number, query: string) => {
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    const limitedContent = paragraphs.slice(0, 3).join('\n\n');
    
    const closingMessage = sources.length > 0 
      ? "\n\nReview the highlighted sources below for complete details. Would you like me to elaborate on any specific aspect?"
      : "";

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-600 font-semibold">
          <span>🤖</span>
          <span>AI Analysis</span>
        </div>
        
        <div className="text-xs text-gray-500 mb-3">
          AI analysis based on {documentCount} relevant document sections
        </div>

        <div 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: renderMarkdown(limitedContent + closingMessage)
          }}
        />

        {sources && sources.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-gray-700">
              <span>📚</span>
              <span>Key Sources</span>
            </div>
            
            <div className="text-xs text-gray-500 mb-3">
              Document excerpts that informed the AI analysis above
            </div>

            {sources.map((source, sourceIndex) => (
              <div key={sourceIndex} className="border-l-4 border-gray-200 pl-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-900">{source.document_title}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewDocument(source, query)}
                    className="text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View with Highlights
                  </Button>
                </div>
                
                {source.excerpts && source.excerpts.length > 0 && (
                  <div className="space-y-1 text-xs">
                    {source.excerpts.slice(0, 3).map((excerpt: any, excerptIndex: number) => (
                      <div key={excerptIndex} className="text-gray-700">
                        <span className="font-medium">
                          • {excerpt.page && `Page ${excerpt.page}`}{excerpt.lines && ` • ${excerpt.lines}`}:
                        </span>
                        <span className="ml-1">"{excerpt.text.substring(0, 80)}..."</span>
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
    return (
      <div className="fixed right-4 bottom-4 z-50">
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full shadow-lg"
          disabled
        >
          <MessageCircle className="h-6 w-6 text-gray-400" />
        </Button>
      </div>
    );
  }

  if (chatState === 'minimized') {
    return (
      <div className="fixed right-4 bottom-4 z-50">
        <Button
          variant="default"
          size="icon"
          className="w-12 h-12 rounded-full shadow-lg"
          onClick={() => setChatState('expanded')}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="fixed right-0 top-0 h-full bg-white border-l shadow-lg z-40 flex"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize"
        onMouseDown={() => setIsResizing(true)}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center">
            <MessageCircle className="mr-2 h-5 w-5" />
            <span className="font-semibold text-gray-900">Chat - {client.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatState(chatState === 'expanded' ? 'collapsed' : 'expanded')}
            >
              {chatState === 'expanded' ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatState('minimized')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {chatState === 'expanded' && (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
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

            {/* Input */}
            <div className="p-4 border-t">
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
              <div className="text-xs text-gray-500 mt-2">
                Cmd/Ctrl + / to toggle • Shift + / to minimize
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FloatingChatPanel;
