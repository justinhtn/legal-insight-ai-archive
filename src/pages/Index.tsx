import { useState, useEffect } from "react";
import { Upload, Search, FolderOpen, FileText, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import DocumentUpload from "@/components/DocumentUpload";
import AuthButton from "@/components/AuthButton";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleDocumentUpload = (files: File[]) => {
    console.log('Uploaded files:', files);
    // Here you would typically process and store the files
    // For now, we'll just log them to the console
  };

  const handleAuthChange = () => {
    // This will trigger the useEffect to update the user state
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar>
          <SidebarContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Legal Archive</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
              
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  All Clients
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Recent Documents
                </Button>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-2">Clients</h3>
                <div className="space-y-1">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    Smith v. Johnson
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    Corporate Merger LLC
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    Estate Planning - Davis
                  </Button>
                </div>
              </div>
            </div>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4 lg:px-6">
              <SidebarTrigger />
              <div className="ml-auto flex items-center space-x-4">
                <div className="relative flex-1 max-w-lg">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Ask anything about your legal documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-full"
                  />
                </div>
                <AuthButton user={user} onAuthChange={handleAuthChange} />
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Legal Document Archive</h1>
                  <p className="text-muted-foreground">
                    AI-powered search across all your legal documents and pleadings
                  </p>
                </div>
                <Button 
                  onClick={() => setIsUploadOpen(true)}
                  disabled={!user}
                  title={!user ? "Please sign in to upload documents" : ""}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              </div>

              {!user && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="pt-6">
                    <p className="text-yellow-800">
                      Please sign in to upload and manage your legal documents. Your documents are securely stored and only accessible to you.
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="mr-2 h-5 w-5" />
                      Total Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">1,247</div>
                    <p className="text-xs text-muted-foreground">
                      Across 23 active cases
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Search className="mr-2 h-5 w-5" />
                      AI Searches Today
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">47</div>
                    <p className="text-xs text-muted-foreground">
                      Average response time: 2.3s
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FolderOpen className="mr-2 h-5 w-5" />
                      Active Matters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">23</div>
                    <p className="text-xs text-muted-foreground">
                      8 require immediate attention
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent AI Searches</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border-l-4 border-primary pl-4">
                      <p className="font-medium">
                        "What are the statute of limitations arguments in breach of contract cases?"
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Found 12 relevant passages across 5 documents
                      </p>
                    </div>
                    <div className="border-l-4 border-muted pl-4">
                      <p className="font-medium">
                        "Show me all discovery motions filed in the past 6 months"
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Found 8 documents with filing dates and case references
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>

        <DocumentUpload
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onUpload={handleDocumentUpload}
        />
      </div>
    </SidebarProvider>
  );
};

export default Index;
