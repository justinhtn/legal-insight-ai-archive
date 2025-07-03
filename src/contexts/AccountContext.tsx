import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Account, Profile } from '@/types/account-profile.types';
import { useToast } from '@/hooks/use-toast';

interface AccountContextType {
  // Current account and profile
  currentAccount: Account | null;
  currentProfile: Profile | null;
  
  // All profiles in the account (for showing who's online, etc.)
  accountProfiles: Profile[];
  
  // Loading states
  isLoading: boolean;
  
  // Actions
  switchAccount: (accountId: string) => Promise<void>;
  refreshAccount: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [accountProfiles, setAccountProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load user's account and profile on mount
  useEffect(() => {
    loadUserAccountAndProfile();
    
    // Set up realtime subscription for profile changes
    const subscription = supabase
      .channel('account-profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: currentAccount ? `account_id=eq.${currentAccount.id}` : undefined
        },
        () => {
          // Refresh profiles when any profile in the account changes
          if (currentAccount) {
            loadAccountProfiles(currentAccount.id);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadUserAccountAndProfile = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user');
        return;
      }

      // Get user's profiles (they might have multiple if invited to multiple accounts)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          account:accounts(*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (profileError) {
        console.error('Error loading profiles:', profileError);
        return;
      }

      if (!profiles || profiles.length === 0) {
        // No profile yet - user needs to create an account or be invited
        console.log('User has no profiles yet');
        return;
      }

      // For now, use the first profile (later we can add account switching)
      const profile = profiles[0];
      setCurrentProfile(profile);
      setCurrentAccount(profile.account);

      // Load all profiles in this account
      if (profile.account) {
        await loadAccountProfiles(profile.account.id);
      }

    } catch (error) {
      console.error('Error loading account/profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load account information',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccountProfiles = async (accountId: string) => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user:auth.users(email, user_metadata)
        `)
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;

      setAccountProfiles(profiles || []);
    } catch (error) {
      console.error('Error loading account profiles:', error);
    }
  };

  const switchAccount = async (accountId: string) => {
    try {
      // Get the profile for this account
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          *,
          account:accounts(*)
        `)
        .eq('account_id', accountId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (error) throw error;

      setCurrentProfile(profile);
      setCurrentAccount(profile.account);
      
      // Load profiles for new account
      await loadAccountProfiles(accountId);

      toast({
        title: 'Account Switched',
        description: `Now using ${profile.account.name}`,
      });
    } catch (error) {
      console.error('Error switching account:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch account',
        variant: 'destructive'
      });
    }
  };

  const refreshAccount = async () => {
    await loadUserAccountAndProfile();
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!currentProfile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentProfile.id);

      if (error) throw error;

      // Update local state
      setCurrentProfile({ ...currentProfile, ...updates });

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      });
    }
  };

  return (
    <AccountContext.Provider
      value={{
        currentAccount,
        currentProfile,
        accountProfiles,
        isLoading,
        switchAccount,
        refreshAccount,
        updateProfile
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};