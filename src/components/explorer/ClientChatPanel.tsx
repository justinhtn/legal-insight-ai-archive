
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2, FileText, ExternalLink } from 'lucide-react';
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

interface ClientChatPanelProps {
  client: Client | null;
  onOpenDocumentWithHighlights?: (document: any, highlights: any[], query: string) => void;
}

const ClientChatPanel: React.FC<ClientChatPanelProps> = ({ 
  client, 
  onOpenDocumentWithHighlights 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history when client changes
  useEffect(() => {
    if (client) {
      loadChatHistory();
    } else {
      setMessages([]);
    }
  }, [client?.id]);

  const loadChatHistory = () => {
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

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/• /g, '• ')
      .replace(/\n/g, '<br/>');
  };

  const formatAIResponse = (content: string, sources: any[], documentCount: number, query: string) => {
    // Limit content to 2-3 paragraphs
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    const limitedContent = paragraphs.slice(0, 3).join('\n\n');
    
    // Add closing message if content was truncated or if sources exist
    const closingMessage = sources.length > 0 
      ? "\n\nReview the highlighted sources below for complete details. Would you like me to elaborate on any specific aspect?"
      : "";

    return (
      <div className="space-y-4">
        {/* AI Analysis Header */}
        <div className="flex items-center gap-2 text-blue-600 font-semibold">
          <span>🤖</span>
          <span>AI Analysis</span>
        </div>
        
        <div className="text-xs text-gray-500 mb-3">
          AI analysis based on {documentCount} relevant document sections
        </div>

        {/* Main Content with Markdown */}
        <div 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: renderMarkdown(limitedContent + closingMessage)
          }}
        />

        {/* Key Sources Section */}
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
                    View Document with Highlights
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
      <div className="h-full flex items-center justify-center bg-gray-50 border-l">
        <div className="text-center text-gray-500">
          <MessageCircle className="mx-auto h-12 w-12 text-gray-300 mb-2" />
          <p>Select a client to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white border-l">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-900 flex items-center">
          <MessageCircle className="mr-2 h-5 w-5" />
          Chat - {client.name}
        </h3>
        <p className="text-sm text-gray-500">Ask about {client.name}'s documents</p>
      </div>

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
      </div>
    </div>
  );
};

export default ClientChatPanel;
