
import React, { useState } from 'react';
import { Users, Plus, ChevronRight, ChevronDown, FolderClosed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Client } from '@/services/clientService';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ClientSidebarProps {
  clients: Client[];
  selectedClientId?: string;
  onClientSelect: (clientId: string) => void;
  onNewClient: () => void;
  isLoading?: boolean;
}

const ClientSidebar: React.FC<ClientSidebarProps> = ({
  clients,
  selectedClientId,
  onClientSelect,
  onNewClient,
  isLoading = false
}) => {
  const [activeExpanded, setActiveExpanded] = useState(true);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [closedExpanded, setClosedExpanded] = useState(false);

  // Categorize clients by status (for now, we'll use matter_type as a simple categorization)
  const activeClients = clients.filter(client => 
    !client.matter_type || 
    client.matter_type.toLowerCase().includes('active') || 
    client.matter_type.toLowerCase().includes('ongoing') ||
    !['closed', 'completed', 'settled'].some(status => client.matter_type?.toLowerCase().includes(status))
  );
  
  const pendingClients = clients.filter(client => 
    client.matter_type?.toLowerCase().includes('pending') || 
    client.matter_type?.toLowerCase().includes('review')
  );
  
  const closedClients = clients.filter(client => 
    client.matter_type && 
    ['closed', 'completed', 'settled'].some(status => client.matter_type?.toLowerCase().includes(status))
  );

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-gray-900 text-white">
        <div className="p-3 border-b border-gray-700 flex-shrink-0">
          <h2 className="font-medium text-sm flex items-center text-gray-200">
            <Users className="mr-2 h-4 w-4" />
            Clients
          </h2>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-center text-gray-400">Loading clients...</div>
        </div>
      </div>
    );
  }

  const ClientSection = ({ 
    title, 
    clients: sectionClients, 
    isExpanded, 
    onToggle, 
    count 
  }: { 
    title: string; 
    clients: Client[]; 
    isExpanded: boolean; 
    onToggle: () => void;
    count: number;
  }) => (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-sm transition-colors">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 mr-1" />
          ) : (
            <ChevronRight className="h-3 w-3 mr-1" />
          )}
          <FolderClosed className="h-3 w-3 mr-2" />
          <span className="flex-1 text-left">{title}</span>
          <span className="text-gray-500">({count})</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 space-y-0.5">
          {sectionClients.map((client) => (
            <button
              key={client.id}
              onClick={() => onClientSelect(client.id)}
              className={`w-full text-left px-2 py-1.5 rounded-sm text-sm transition-colors ${
                selectedClientId === client.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              <div className="font-medium truncate">{client.name}</div>
              {client.case_number && (
                <div className="text-xs text-gray-400 truncate">
                  Case: {client.case_number}
                </div>
              )}
            </button>
          ))}
          
          {sectionClients.length === 0 && (
            <div className="text-xs text-gray-500 px-2 py-1">
              No {title.toLowerCase()} cases
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white border-r border-gray-700">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex-shrink-0">
        <h2 className="font-medium text-sm flex items-center text-gray-200">
          <Users className="mr-2 h-4 w-4" />
          Clients
        </h2>
      </div>
      
      {/* Client Sections */}
      <div className="flex-1 p-2 overflow-y-auto">
        <div className="space-y-1">
          <ClientSection
            title="Active Cases"
            clients={activeClients}
            isExpanded={activeExpanded}
            onToggle={() => setActiveExpanded(!activeExpanded)}
            count={activeClients.length}
          />
          
          <ClientSection
            title="Pending Cases"
            clients={pendingClients}
            isExpanded={pendingExpanded}
            onToggle={() => setPendingExpanded(!pendingExpanded)}
            count={pendingClients.length}
          />
          
          <ClientSection
            title="Closed Cases"
            clients={closedClients}
            isExpanded={closedExpanded}
            onToggle={() => setClosedExpanded(!closedExpanded)}
            count={closedClients.length}
          />
        </div>
        
        {clients.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Users className="mx-auto h-12 w-12 text-gray-600 mb-2" />
            <p className="text-sm">No clients yet</p>
            <p className="text-xs text-gray-500">Create your first client to get started</p>
          </div>
        )}
      </div>

      {/* New Client Button */}
      <div className="p-3 border-t border-gray-700 flex-shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={onNewClient}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-600"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Client
        </Button>
      </div>
    </div>
  );
};

export default ClientSidebar;
