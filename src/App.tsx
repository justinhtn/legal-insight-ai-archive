
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AccountProvider } from "@/contexts/AccountContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SharedDocument from "./pages/SharedDocument";
import AccountSetup from "./components/auth/AccountSetup";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const AppContent = () => {
  const [user, setUser] = useState<any>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserProfile(session.user.id);
      } else {
        setHasProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        // If profiles table doesn't exist yet, treat as no profile
        console.log('Profiles table not found, treating as new user');
        setHasProfile(false);
        return;
      }

      setHasProfile(data && data.length > 0);
    } catch (error) {
      console.error('Error checking profile:', error);
      setHasProfile(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Show account setup for authenticated users without a profile
  if (user && hasProfile === false) {
    return <AccountSetup onComplete={() => setHasProfile(true)} />;
  }

  // Show main app
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/shared/:shareToken" element={<SharedDocument />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AccountProvider>
            <AppContent />
          </AccountProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
