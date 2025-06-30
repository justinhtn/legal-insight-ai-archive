
import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GmailStyleChatPanel from './GmailStyleChatPanel';
import { Client } from '@/services/clientService';
import { useChatIntegration } from '@/hooks/useChatIntegration';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';

interface ChatIntegrationProps {
  selectedClient: Client | null;
}

const ChatIntegration: React.FC<ChatIntegrationProps> = ({ selectedClient }) => {
  const { isChatOpen, toggleChat } = useChatIntegration();
  const { handleDocumentOpen, handleTabChange } = useDocumentTabs();

  if (!selectedClient) return null;

  return (
    <>
      {/* Floating Chat Toggle Button - Only when chat is closed */}
      {!isChatOpen && (
        <div className="fixed top-20 right-4 z-50">
          <Button
            onClick={toggleChat}
            variant="default"
            size="icon"
            className="w-12 h-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
          >
            <MessageCircle className="h-6 w-6 text-white" />
          </Button>
        </div>
      )}

      {/* Chat Panel Content - Rendered in the flex layout */}
      {isChatOpen && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center">
              <MessageCircle className="mr-2 h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-900">{selectedClient.name}</span>
            </div>
            <Button
              onClick={toggleChat}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-hidden">
            <GmailStyleChatPanel
              client={selectedClient}
              isOpen={isChatOpen}
              onOpenDocumentWithHighlights={handleDocumentOpen}
              onToggle={toggleChat}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ChatIntegration;
