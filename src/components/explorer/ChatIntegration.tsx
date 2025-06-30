
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GmailStyleChat from './GmailStyleChat';
import { Client } from '@/services/clientService';
import { useChatIntegration } from '@/hooks/useChatIntegration';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';

interface ChatIntegrationProps {
  selectedClient: Client | null;
}

const ChatIntegration: React.FC<ChatIntegrationProps> = ({ selectedClient }) => {
  const { isChatOpen, toggleChat } = useChatIntegration();
  const { openTabs, handleDocumentOpen, handleTabChange } = useDocumentTabs();

  if (!selectedClient) return null;

  return (
    <>
      {/* Floating Chat Toggle Button */}
      {!isChatOpen && (
        <div className="absolute top-20 right-4 z-10">
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

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white">
          <GmailStyleChat
            client={selectedClient}
            isOpen={isChatOpen}
            onOpenDocumentWithHighlights={handleDocumentOpen}
            onToggle={toggleChat}
            openTabs={openTabs}
            onSwitchToTab={handleTabChange}
          />
        </div>
      )}
    </>
  );
};

export default ChatIntegration;
