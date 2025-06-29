
import React from 'react';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Client } from '@/services/clientService';

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
  if (isLoading) {
    return (
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b bg-white">
          <h2 className="font-semibold text-lg flex items-center">
            <Users className="mr-2 h-5 w-5" />
            All Clients
          </h2>
        </div>
        <div className="flex-1 p-4">
          <div className="text-center text-gray-500">Loading clients...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-r bg-gray-50 flex flex-col">
      <div className="p-4 border-b bg-white">
        <h2 className="font-semibold text-lg flex items-center">
          <Users className="mr-2 h-5 w-5" />
          All Clients
        </h2>
      </div>
      
      <div className="flex-1 p-2 overflow-auto">
        <div className="space-y-1">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => onClientSelect(client.id)}
              className={`w-full text-left px-3 py-3 rounded-md text-sm hover:bg-white transition-colors ${
                selectedClientId === client.id 
                  ? 'bg-blue-100 text-blue-900 border border-blue-200' 
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <div className="font-medium truncate">{client.name}</div>
              {client.matter_type && (
                <div className="text-xs text-gray-500 truncate mt-1">
                  {client.matter_type}
                </div>
              )}
            </button>
          ))}
          
          {clients.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto h-12 w-12 text-gray-300 mb-2" />
              <p>No clients yet</p>
              <p className="text-xs">Create your first client to get started</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t bg-white">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewClient}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Client
        </Button>
      </div>
    </div>
  );
};

export default ClientSidebar;
