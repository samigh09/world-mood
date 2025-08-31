import { useState } from "react";
import { MoodSelector } from "@/components/MoodSelector";
import { WorldMoodMap } from "@/components/WorldMoodMap";
import { MoodDashboard } from "@/components/MoodDashboard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleMoodShared = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-cosmic">
      {/* Header */}
      <header className="px-4 py-3 sm:p-6 text-center bg-gradient-aurora border-b border-border/20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-primary via-accent to-mood-excited bg-clip-text text-transparent animate-fade-in">
            World Mood Map
          </h1>
          <p className="text-lg text-muted-foreground animate-fade-in" style={{ animationDelay: "0.2s" }}>
            See how the world is feeling right now ✨
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Mobile-first tab layout */}
        <Tabs defaultValue="share" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-background/50 backdrop-blur-sm">
            <TabsTrigger value="share" className="flex items-center gap-2">
              <span className="text-lg">😊</span>
              <span className="hidden sm:inline">Share Mood</span>
              <span className="sm:hidden">Share</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <span className="text-lg">🌍</span>
              <span className="hidden sm:inline">World Map</span>
              <span className="sm:hidden">Map</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <span className="hidden sm:inline">Insights</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="animate-fade-in">
            <div className="max-w-md mx-auto">
              <MoodSelector onMoodShared={handleMoodShared} />
            </div>
          </TabsContent>

          <TabsContent value="map" className="animate-fade-in">
            <WorldMoodMap refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="stats" className="animate-fade-in">
            <MoodDashboard />
          </TabsContent>
        </Tabs>

        {/* Quick stats footer */}
        <footer className="text-center py-8 border-t border-border/20">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Connecting hearts and minds across the globe 🌍</p>
            <div className="flex justify-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-mood-happy rounded-full animate-pulse-mood"></div>
                Live updates
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-mood-calm rounded-full animate-pulse-mood"></div>
                Anonymous sharing
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-mood-creative rounded-full animate-pulse-mood"></div>
                Global insights
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
