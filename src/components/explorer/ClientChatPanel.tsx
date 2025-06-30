
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
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
  }>;
}

interface ClientChatPanelProps {
  client: Client | null;
}

const ClientChatPanel: React.FC<ClientChatPanelProps> = ({ client }) => {
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
    // For now, we'll start with empty chat history
    // In a real implementation, you'd load from database
    setMessages([]);
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
    setInputValue('');
    setIsLoading(true);

    try {
      // Use the existing search service to get AI responses
      const response = await searchDocuments(userMessage.content, client.id);
      
      // Extract sources from consolidated documents
      const sources = response.consolidated_documents?.slice(0, 3).map(doc => {
        // Get unique page numbers from excerpts
        const pages = doc.excerpts
          .map(excerpt => excerpt.page)
          .filter((page): page is number => typeof page === 'number')
          .filter((page, index, arr) => arr.indexOf(page) === index)
          .sort((a, b) => a - b);

        return {
          document_title: doc.document_title,
          document_file_name: doc.document_file_name,
          pages: pages.length > 0 ? pages : undefined,
        };
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.ai_response || 'I couldn\'t find relevant information in the documents.',
        timestamp: new Date(),
        sources,
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
              <Card className={`max-w-[80%] p-3 ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100'
              }`}>
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-1">Sources:</p>
                    <div className="space-y-1">
                      {message.sources.map((source, index) => (
                        <div key={index} className="text-xs text-gray-600">
                          • {source.document_title}
                          {source.pages && source.pages.length > 0 && (
                            <span>
                              {source.pages.length === 1 
                                ? `, page ${source.pages[0]}`
                                : `, pages ${source.pages.join(', ')}`
                              }
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-xs opacity-70 mt-1">
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
                  AI is thinking...
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
