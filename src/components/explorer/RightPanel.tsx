
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GmailStyleChatPanel from './GmailStyleChatPanel';
import ClientInfoPanel from '../finder/ClientInfoPanel';
import { Client } from '@/services/clientService';

interface RightPanelProps {
  isOpen: boolean;
  mode: 'chat' | 'client-info' | null;
  selectedClient: Client | null;
  onClose: () => void;
  onClientUpdated: (client: Client) => void;
  onOpenDocumentWithHighlights: (document: any, highlights: any[], query: string) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({
  isOpen,
  mode,
  selectedClient,
  onClose,
  onClientUpdated,
  onOpenDocumentWithHighlights
}) => {
  if (!isOpen || !mode) return null;

  return (
    <div className="h-full border-l border-gray-200 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-gray-900">
          {mode === 'chat' ? 'Chat' : 'Client Information'}
        </h3>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content - Use remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'chat' && selectedClient && (
          <GmailStyleChatPanel
            client={selectedClient}
            isOpen={isOpen}
            onOpenDocumentWithHighlights={onOpenDocumentWithHighlights}
            onToggle={onClose}
          />
        )}
        
        {mode === 'client-info' && selectedClient && (
          <div className="flex-1 overflow-y-auto p-4 h-full">
            <ClientInfoPanel
              client={selectedClient}
              onClientUpdated={onClientUpdated}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default RightPanel;
