import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Share2, 
  Copy, 
  Mail, 
  UserPlus, 
  Link, 
  Trash2, 
  Clock,
  Shield,
  Users,
  Eye,
  Edit3,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface DocumentShare {
  id: string;
  shared_with: string;
  permission_level: 'read' | 'comment' | 'edit' | 'admin';
  shared_at: string;
  expires_at?: string;
  user: {
    email: string;
    user_metadata?: { name?: string };
  };
}

interface ShareLink {
  id: string;
  share_token: string;
  permission_level: 'read' | 'comment' | 'edit';
  requires_auth: boolean;
  max_uses?: number;
  used_count: number;
  expires_at?: string;
  created_at: string;
}

interface DocumentSharingModalProps {
  documentId: string;
  documentTitle: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

const PERMISSION_ICONS = {
  read: Eye,
  comment: MessageSquare,
  edit: Edit3,
  admin: Shield
};

const PERMISSION_LABELS = {
  read: 'Can view',
  comment: 'Can comment',
  edit: 'Can edit',
  admin: 'Full access'
};

const PERMISSION_DESCRIPTIONS = {
  read: 'Can view the document and version history',
  comment: 'Can view and add comments',
  edit: 'Can view, comment, and edit the document',
  admin: 'Full access including sharing and deletion'
};

const DocumentSharingModal: React.FC<DocumentSharingModalProps> = ({
  documentId,
  documentTitle,
  isOpen,
  onClose,
  currentUserId
}) => {
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPermission, setNewUserPermission] = useState<'read' | 'comment' | 'edit'>('read');
  const [isLoading, setIsLoading] = useState(false);
  const [showLinkCreation, setShowLinkCreation] = useState(false);
  const [newLinkPermission, setNewLinkPermission] = useState<'read' | 'comment' | 'edit'>('read');
  const [newLinkRequiresAuth, setNewLinkRequiresAuth] = useState(true);
  const [newLinkExpires, setNewLinkExpires] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadShares();
      loadShareLinks();
    }
  }, [isOpen, documentId]);

  const loadShares = async () => {
    try {
      const { data, error } = await supabase
        .from('document_shares')
        .select(`
          *,
          user:shared_with(email, user_metadata)
        `)
        .eq('document_id', documentId)
        .eq('is_active', true);

      if (error) throw error;
      setShares(data || []);
    } catch (error) {
      console.error('Error loading shares:', error);
    }
  };

  const loadShareLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('document_share_links')
        .select('*')
        .eq('document_id', documentId)
        .eq('is_active', true);

      if (error) throw error;
      setShareLinks(data || []);
    } catch (error) {
      console.error('Error loading share links:', error);
    }
  };

  const shareWithUser = async () => {
    if (!newUserEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // First, find the user by email
      const { data: userData, error: userError } = await supabase
        .from('profiles') // Assuming you have a profiles table
        .select('id')
        .eq('email', newUserEmail.trim())
        .single();

      if (userError || !userData) {
        toast({
          title: "User Not Found",
          description: "No user found with that email address",
          variant: "destructive"
        });
        return;
      }

      // Create the share
      const { error: shareError } = await supabase
        .from('document_shares')
        .insert({
          document_id: documentId,
          shared_by: currentUserId,
          shared_with: userData.id,
          permission_level: newUserPermission
        });

      if (shareError) {
        if (shareError.code === '23505') { // Unique constraint violation
          toast({
            title: "Already Shared",
            description: "Document is already shared with this user",
            variant: "destructive"
          });
        } else {
          throw shareError;
        }
        return;
      }

      toast({
        title: "Document Shared",
        description: `Document shared with ${newUserEmail} with ${PERMISSION_LABELS[newUserPermission]} permission`,
      });

      setNewUserEmail('');
      setNewUserPermission('read');
      loadShares();

    } catch (error) {
      console.error('Error sharing document:', error);
      toast({
        title: "Sharing Failed",
        description: "Failed to share document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePermission = async (shareId: string, newPermission: string) => {
    try {
      const { error } = await supabase
        .from('document_shares')
        .update({ permission_level: newPermission })
        .eq('id', shareId);

      if (error) throw error;

      toast({
        title: "Permission Updated",
        description: `Permission updated to ${PERMISSION_LABELS[newPermission as keyof typeof PERMISSION_LABELS]}`,
      });

      loadShares();
    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update permission",
        variant: "destructive"
      });
    }
  };

  const removeShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('document_shares')
        .update({ is_active: false })
        .eq('id', shareId);

      if (error) throw error;

      toast({
        title: "Access Removed",
        description: "User access has been removed",
      });

      loadShares();
    } catch (error) {
      console.error('Error removing share:', error);
      toast({
        title: "Removal Failed",
        description: "Failed to remove access",
        variant: "destructive"
      });
    }
  };

  const createShareLink = async () => {
    setIsLoading(true);
    try {
      const shareToken = generateRandomToken();
      const expiresAt = newLinkExpires ? new Date(newLinkExpires).toISOString() : null;

      const { error } = await supabase
        .from('document_share_links')
        .insert({
          document_id: documentId,
          created_by: currentUserId,
          share_token: shareToken,
          permission_level: newLinkPermission,
          requires_auth: newLinkRequiresAuth,
          expires_at: expiresAt
        });

      if (error) throw error;

      toast({
        title: "Share Link Created",
        description: "Document share link has been created",
      });

      setShowLinkCreation(false);
      setNewLinkPermission('read');
      setNewLinkRequiresAuth(true);
      setNewLinkExpires('');
      loadShareLinks();

    } catch (error) {
      console.error('Error creating share link:', error);
      toast({
        title: "Link Creation Failed",
        description: "Failed to create share link",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyShareLink = (shareToken: string) => {
    const url = `${window.location.origin}/shared/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Share link copied to clipboard",
    });
  };

  const revokeShareLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('document_share_links')
        .update({ is_active: false })
        .eq('id', linkId);

      if (error) throw error;

      toast({
        title: "Link Revoked",
        description: "Share link has been revoked",
      });

      loadShareLinks();
    } catch (error) {
      console.error('Error revoking link:', error);
      toast({
        title: "Revocation Failed",
        description: "Failed to revoke share link",
        variant: "destructive"
      });
    }
  };

  const generateRandomToken = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => 
      byte.toString(16).padStart(2, '0')
    ).join('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Share2 className="h-5 w-5 mr-2" />
            Share "{documentTitle}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add People Section */}
          <div>
            <h3 className="font-medium text-sm mb-3 flex items-center">
              <UserPlus className="h-4 w-4 mr-2" />
              Add People
            </h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Enter email address"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && shareWithUser()}
                />
              </div>
              <Select value={newUserPermission} onValueChange={(value) => setNewUserPermission(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Can view</SelectItem>
                  <SelectItem value="comment">Can comment</SelectItem>
                  <SelectItem value="edit">Can edit</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={shareWithUser} disabled={isLoading}>
                <Mail className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>
          </div>

          <Separator />

          {/* Current Shares */}
          <div>
            <h3 className="font-medium text-sm mb-3 flex items-center">
              <Users className="h-4 w-4 mr-2" />
              People with Access ({shares.length})
            </h3>
            <div className="space-y-2">
              {shares.map((share) => {
                const PermissionIcon = PERMISSION_ICONS[share.permission_level];
                return (
                  <div key={share.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {share.user.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">
                          {share.user.user_metadata?.name || share.user.email}
                        </div>
                        <div className="text-xs text-gray-500">{share.user.email}</div>
                        <div className="text-xs text-gray-400">
                          Shared {format(new Date(share.shared_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={share.permission_level} 
                        onValueChange={(value) => updatePermission(share.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">
                            <div className="flex items-center">
                              <Eye className="h-3 w-3 mr-2" />
                              Can view
                            </div>
                          </SelectItem>
                          <SelectItem value="comment">
                            <div className="flex items-center">
                              <MessageSquare className="h-3 w-3 mr-2" />
                              Can comment
                            </div>
                          </SelectItem>
                          <SelectItem value="edit">
                            <div className="flex items-center">
                              <Edit3 className="h-3 w-3 mr-2" />
                              Can edit
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center">
                              <Shield className="h-3 w-3 mr-2" />
                              Full access
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeShare(share.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Share Links Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm flex items-center">
                <Link className="h-4 w-4 mr-2" />
                Share Links ({shareLinks.length})
              </h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowLinkCreation(!showLinkCreation)}
              >
                <Link className="h-3 w-3 mr-1" />
                Create Link
              </Button>
            </div>

            {showLinkCreation && (
              <div className="p-4 border rounded-lg mb-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Permission Level</Label>
                    <Select value={newLinkPermission} onValueChange={(value) => setNewLinkPermission(value as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Can view</SelectItem>
                        <SelectItem value="comment">Can comment</SelectItem>
                        <SelectItem value="edit">Can edit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Expires (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={newLinkExpires}
                      onChange={(e) => setNewLinkExpires(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requires-auth"
                    checked={newLinkRequiresAuth}
                    onCheckedChange={setNewLinkRequiresAuth}
                  />
                  <Label htmlFor="requires-auth" className="text-sm">
                    Require authentication
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createShareLink} disabled={isLoading}>
                    Create Link
                  </Button>
                  <Button variant="outline" onClick={() => setShowLinkCreation(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {shareLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary">{PERMISSION_LABELS[link.permission_level]}</Badge>
                      {!link.requires_auth && <Badge variant="outline">Public</Badge>}
                      {link.expires_at && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Expires {format(new Date(link.expires_at), 'MMM d')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Created {format(new Date(link.created_at), 'MMM d, yyyy')} • Used {link.used_count} times
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyShareLink(link.share_token)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Link
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => revokeShareLink(link.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentSharingModal;