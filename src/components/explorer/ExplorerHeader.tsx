
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, User, X } from 'lucide-react';

interface ExplorerHeaderProps {
  isChatOpen: boolean;
  isClientInfoOpen: boolean;
  onToggleChat: () => void;
  onToggleClientInfo: () => void;
  selectedClientName?: string;
}

const ExplorerHeader: React.FC<ExplorerHeaderProps> = ({
  isChatOpen,
  isClientInfoOpen,
  onToggleChat,
  onToggleClientInfo,
  selectedClientName
}) => {
  return (
    <div className="h-12 px-4 border-b bg-white flex items-center justify-between">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-900">Legal Document Manager</h1>
        {selectedClientName && (
          <span className="ml-4 text-sm text-gray-600">Client: {selectedClientName}</span>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {selectedClientName && (
          <Button
            variant={isClientInfoOpen ? "default" : "outline"}
            size="sm"
            onClick={onToggleClientInfo}
          >
            <User className="h-4 w-4 mr-1" />
            Client Info
          </Button>
        )}
        
        <Button
          variant={isChatOpen ? "default" : "outline"}
          size="sm"
          onClick={onToggleChat}
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          Chat
        </Button>
      </div>
    </div>
  );
};

export default ExplorerHeader;
