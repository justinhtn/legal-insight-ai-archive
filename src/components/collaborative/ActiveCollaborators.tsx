import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CollaborativeSession, Profile } from '@/types/account-profile.types';
import { useAccount } from '@/contexts/AccountContext';

interface ActiveCollaboratorsProps {
  documentId: string;
  currentProfileId: string;
}

interface ActiveCollaborator extends CollaborativeSession {
  profile: Profile & {
    user?: {
      email: string;
    };
  };
}

const COLLABORATOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

const ActiveCollaborators: React.FC<ActiveCollaboratorsProps> = ({
  documentId,
  currentProfileId
}) => {
  const [activeCollaborators, setActiveCollaborators] = useState<ActiveCollaborator[]>([]);
  const { accountProfiles } = useAccount();

  useEffect(() => {
    // Load initial active sessions
    loadActiveSessions();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`document-${documentId}-collaborators`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collaborative_sessions',
          filter: `document_id=eq.${documentId}`
        },
        () => {
          loadActiveSessions();
        }
      )
      .subscribe();

    // Clean up inactive sessions periodically
    const cleanupInterval = setInterval(() => {
      cleanupInactiveSessions();
    }, 30000); // Every 30 seconds

    return () => {
      channel.unsubscribe();
      clearInterval(cleanupInterval);
    };
  }, [documentId]);

  const loadActiveSessions = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('collaborative_sessions')
        .select(`
          *,
          profile:profiles(
            *,
            user:auth.users(email)
          )
        `)
        .eq('document_id', documentId)
        .eq('is_active', true)
        .gte('last_activity', fiveMinutesAgo);

      if (error) throw error;

      // Assign colors based on profile index in account
      const collaboratorsWithColors = (data || []).map((session, index) => ({
        ...session,
        user_color: session.user_color || COLLABORATOR_COLORS[index % COLLABORATOR_COLORS.length]
      }));

      setActiveCollaborators(collaboratorsWithColors);
    } catch (error) {
      console.error('Error loading active sessions:', error);
    }
  };

  const cleanupInactiveSessions = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      await supabase
        .from('collaborative_sessions')
        .update({ is_active: false })
        .eq('document_id', documentId)
        .lt('last_activity', fiveMinutesAgo);
    } catch (error) {
      console.error('Error cleaning up inactive sessions:', error);
    }
  };

  // Filter out current user from the list
  const otherCollaborators = activeCollaborators.filter(
    session => session.profile_id !== currentProfileId
  );

  if (otherCollaborators.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-gray-500" />
        <div className="flex -space-x-2">
          {otherCollaborators.slice(0, 3).map((collaborator) => (
            <Tooltip key={collaborator.id}>
              <TooltipTrigger>
                <div className="relative">
                  <Avatar className="h-8 w-8 border-2 border-white">
                    <AvatarFallback 
                      style={{ backgroundColor: collaborator.user_color }}
                      className="text-white text-xs font-medium"
                    >
                      {collaborator.profile.display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Circle 
                    className="absolute bottom-0 right-0 h-3 w-3 fill-green-500 text-green-500"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div>
                  <p className="font-medium">{collaborator.profile.display_name}</p>
                  <p className="text-xs text-gray-500">{collaborator.profile.title || collaborator.profile.role}</p>
                  {collaborator.cursor_position && (
                    <p className="text-xs text-gray-400">
                      Line {collaborator.cursor_position.line}, Col {collaborator.cursor_position.column}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
          {otherCollaborators.length > 3 && (
            <Badge variant="secondary" className="h-8 px-2">
              +{otherCollaborators.length - 3}
            </Badge>
          )}
        </div>
        <span className="text-sm text-gray-600">
          {otherCollaborators.length} {otherCollaborators.length === 1 ? 'editor' : 'editors'} active
        </span>
      </div>
    </TooltipProvider>
  );
};

export default ActiveCollaborators;