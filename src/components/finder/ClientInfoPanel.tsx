
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Edit, Save, X } from 'lucide-react';
import { Client, updateClient } from '@/services/clientService';
import { useToast } from '@/hooks/use-toast';

interface ClientInfoPanelProps {
  client: Client;
  onClientUpdated: (client: Client) => void;
}

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({ client, onClientUpdated }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: client.name,
    email: client.email || '',
    phone: client.phone || '',
    case_number: client.case_number || '',
    matter_type: client.matter_type || '',
    notes: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      case_number: client.case_number || '',
      matter_type: client.matter_type || '',
      notes: ''
    });
  }, [client]);

  const handleSave = async () => {
    try {
      const updatedClient = await updateClient(client.id, formData);
      onClientUpdated(updatedClient);
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Client information updated successfully",
      });
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Error",
        description: "Failed to update client information",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      case_number: client.case_number || '',
      matter_type: client.matter_type || '',
      notes: ''
    });
    setIsEditing(false);
  };

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                Client Information
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
              <div className="flex space-x-2">
                {!isEditing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave();
                      }}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Client Name</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                ) : (
                  <div className="font-medium">{client.name}</div>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                ) : (
                  <div>{client.email || 'Not provided'}</div>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                ) : (
                  <div>{client.phone || 'Not provided'}</div>
                )}
              </div>
              <div>
                <Label htmlFor="case_number">Case Number</Label>
                {isEditing ? (
                  <Input
                    id="case_number"
                    value={formData.case_number}
                    onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
                  />
                ) : (
                  <div>{client.case_number || 'Not assigned'}</div>
                )}
              </div>
              <div className="col-span-2">
                <Label htmlFor="matter_type">Matter Type</Label>
                {isEditing ? (
                  <Input
                    id="matter_type"
                    value={formData.matter_type}
                    onChange={(e) => setFormData({ ...formData, matter_type: e.target.value })}
                  />
                ) : (
                  <div>{client.matter_type || 'Not specified'}</div>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-500 pt-2 border-t">
              Created: {new Date(client.created_at).toLocaleDateString()}
              {client.updated_at !== client.created_at && (
                <> • Updated: {new Date(client.updated_at).toLocaleDateString()}</>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ClientInfoPanel;
