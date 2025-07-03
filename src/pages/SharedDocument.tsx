import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Lock, 
  AlertTriangle, 
  ArrowLeft,
  User,
  Calendar,
  Eye,
  Edit3,
  MessageSquare
} from 'lucide-react';
import { documentSharingService } from '@/services/documentSharingService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import CollaborativeDocumentEditor from '@/components/collaborative/CollaborativeDocumentEditor';

interface SharedDocumentData {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  owner?: {
    email: string;
    user_metadata?: { name?: string };
  };
}

const PERMISSION_ICONS = {
  read: Eye,
  comment: MessageSquare,
  edit: Edit3
};

const PERMISSION_LABELS = {
  read: 'View Only',
  comment: 'Can Comment',
  edit: 'Can Edit'
};

const SharedDocument: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [document, setDocument] = useState<SharedDocumentData | null>(null);
  const [permission, setPermission] = useState<'read' | 'comment' | 'edit' | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);

  useEffect(() => {
    if (shareToken) {
      loadSharedDocument();
    }
  }, [shareToken]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const loadSharedDocument = async () => {
    if (!shareToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await documentSharingService.accessDocumentViaLink(shareToken);
      
      if (!result.success) {
        setError(result.error || 'Failed to access document');
        return;
      }

      if (!result.document || !result.permission) {
        setError('Invalid document data');
        return;
      }

      // Load document owner information
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('email, user_metadata')
        .eq('id', result.document.user_id)
        .single();

      setDocument({
        ...result.document,
        owner: ownerData
      });
      setPermission(result.permission as 'read' | 'comment' | 'edit');

      toast({
        title: "Document Accessed",
        description: `You have ${PERMISSION_LABELS[result.permission as keyof typeof PERMISSION_LABELS]} access to this document`,
      });

    } catch (error) {
      console.error('Error loading shared document:', error);
      setError('Failed to load document. The link may be invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    // Redirect to sign in with return URL
    const returnUrl = encodeURIComponent(window.location.pathname);
    navigate(`/auth?returnTo=${returnUrl}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shared document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={() => navigate('/')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Homepage
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (requiresAuth && !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Lock className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h1>
          <p className="text-gray-600 mb-4">
            This shared document requires you to sign in to access it.
          </p>
          <Button onClick={handleSignIn} className="w-full">
            Sign In to Continue
          </Button>
        </Card>
      </div>
    );
  }

  if (!document || !permission) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Document not found</p>
      </div>
    );
  }

  const PermissionIcon = PERMISSION_ICONS[permission];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-gray-500" />
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{document.title}</h1>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <User className="h-3 w-3" />
                    <span>Shared by {document.owner?.user_metadata?.name || document.owner?.email}</span>
                    <span>•</span>
                    <Calendar className="h-3 w-3" />
                    <span>Updated {format(new Date(document.updated_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <PermissionIcon className="h-3 w-3" />
                {PERMISSION_LABELS[permission]}
              </Badge>
              
              {!currentUser && (
                <Button variant="outline" size="sm" onClick={handleSignIn}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {permission === 'read' ? (
          // Read-only view
          <div className="p-6">
            <Alert className="mb-6">
              <Eye className="h-4 w-4" />
              <AlertDescription>
                You have view-only access to this document. 
                {!currentUser && " Sign in to request edit access."}
              </AlertDescription>
            </Alert>
            
            <div className="bg-white border rounded-lg p-6">
              <div className="prose prose-sm max-w-none font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {document.content}
              </div>
            </div>
          </div>
        ) : (
          // Collaborative editing view (comment or edit access)
          currentUser ? (
            <div className="h-screen">
              <CollaborativeDocumentEditor
                documentId={document.id}
                documentTitle={document.title}
                initialContent={document.content}
                currentUser={{
                  id: currentUser.id,
                  name: currentUser.user_metadata?.name || currentUser.email.split('@')[0],
                  email: currentUser.email
                }}
                onVersionHistoryToggle={() => {}}
                showVersionHistory={false}
              />
            </div>
          ) : (
            <div className="p-6">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  Sign in to use collaborative editing features for this document.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 bg-white border rounded-lg p-6">
                <div className="prose prose-sm max-w-none font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {document.content}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default SharedDocument;