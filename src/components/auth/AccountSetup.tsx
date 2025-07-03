import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, User, Building, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { slugify } from '@/utils/stringUtils';

interface AccountSetupProps {
  onComplete?: () => void;
}

const AccountSetup: React.FC<AccountSetupProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    accountName: '',
    accountSlug: '',
    profileName: '',
    profileTitle: ''
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auto-generate slug from account name
  const handleAccountNameChange = (name: string) => {
    setFormData({
      ...formData,
      accountName: name,
      accountSlug: slugify(name)
    });
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Call the create_account_with_owner function
      const { data: account, error: accountError } = await supabase
        .rpc('create_account_with_owner', {
          p_account_name: formData.accountName,
          p_owner_name: formData.profileName
        });

      if (accountError) throw accountError;

      // Update the profile with additional info
      if (formData.profileTitle) {
        await supabase
          .from('profiles')
          .update({ title: formData.profileTitle })
          .eq('account_id', account.id)
          .eq('user_id', user.id);
      }

      toast({
        title: 'Account Created!',
        description: `Welcome to ${formData.accountName}`,
      });

      // Refresh the page or redirect
      if (onComplete) {
        onComplete();
      } else {
        navigate('/');
      }
      
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create account',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Set Up Your Legal Workspace
          </CardTitle>
          <CardDescription>
            Create your account to start managing legal documents
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">
                  <Building className="h-4 w-4 inline mr-1" />
                  Organization Name
                </Label>
                <Input
                  id="accountName"
                  value={formData.accountName}
                  onChange={(e) => handleAccountNameChange(e.target.value)}
                  placeholder="Smith & Associates Law Firm"
                  className="text-lg"
                />
                <p className="text-sm text-gray-500">
                  This is your firm or organization name
                </p>
              </div>

              {formData.accountSlug && (
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-600">
                    Your workspace URL will be:
                    <br />
                    <span className="font-mono text-xs">
                      {window.location.origin}/{formData.accountSlug}
                    </span>
                  </p>
                </div>
              )}

              <Button
                onClick={() => setStep(2)}
                disabled={!formData.accountName}
                className="w-full"
                size="lg"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profileName">
                  <User className="h-4 w-4 inline mr-1" />
                  Your Name
                </Label>
                <Input
                  id="profileName"
                  value={formData.profileName}
                  onChange={(e) => setFormData({ ...formData, profileName: e.target.value })}
                  placeholder="John Smith"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileTitle">
                  Title (Optional)
                </Label>
                <Input
                  id="profileTitle"
                  value={formData.profileTitle}
                  onChange={(e) => setFormData({ ...formData, profileTitle: e.target.value })}
                  placeholder="Senior Partner"
                />
              </div>

              <div className="p-4 bg-blue-50 rounded-md">
                <h4 className="font-medium text-sm mb-2">As the account owner, you can:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Invite team members to collaborate</li>
                  <li>• Manage billing and subscription</li>
                  <li>• Control document access and permissions</li>
                  <li>• View all activity across your account</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreateAccount}
                  disabled={!formData.profileName || isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSetup;