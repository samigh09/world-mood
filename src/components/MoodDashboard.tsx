import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface MoodStats {
  mood_name: string;
  mood_color: string;
  mood_emoji: string;
  count: number;
  percentage: number;
}

interface TimeStats {
  hour: number;
  total_moods: number;
  dominant_mood: string;
  dominant_emoji: string;
}

export const MoodDashboard = () => {
  const [moodStats, setMoodStats] = useState<MoodStats[]>([]);
  const [timeStats, setTimeStats] = useState<TimeStats[]>([]);
  const [totalMoods, setTotalMoods] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Get last 48 hours mood distribution to match the map exactly
      const last48Hours = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: moodsToday, error: moodError } = await supabase
        .from("moods")
        .select("mood_name, mood_color, mood_emoji, created_at")
        .gte("created_at", last48Hours)
        .order("created_at", { ascending: false });

      if (moodError) throw moodError;

      // Calculate mood statistics
      const moodCounts = moodsToday?.reduce((acc, mood) => {
        acc[mood.mood_name] = (acc[mood.mood_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const total = moodsToday?.length || 0;
      setTotalMoods(total);

      const stats = Object.entries(moodCounts).map(([name, count]) => {
        const moodData = moodsToday?.find(m => m.mood_name === name);
        return {
          mood_name: name,
          mood_color: moodData?.mood_color || "happy",
          mood_emoji: moodData?.mood_emoji || "😊",
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      }).sort((a, b) => b.count - a.count);

      setMoodStats(stats);

      // Get hourly trends for last 48 hours to match map data
      const { data: hourlyData, error: hourlyError } = await supabase
        .from("moods")
        .select("created_at, mood_name, mood_emoji")
        .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

      if (hourlyError) throw hourlyError;

      // Group by hour
      const hourlyStats = hourlyData?.reduce((acc, mood) => {
        const hour = new Date(mood.created_at).getHours();
        if (!acc[hour]) {
          acc[hour] = { moods: [], count: 0 };
        }
        acc[hour].moods.push(mood);
        acc[hour].count++;
        return acc;
      }, {} as Record<number, { moods: any[], count: number }>) || {};

      const timeStatsArray = Object.entries(hourlyStats).map(([hour, data]) => {
        const moodCounts = data.moods.reduce((acc, mood) => {
          acc[mood.mood_name] = (acc[mood.mood_name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const dominantMood = Object.entries(moodCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
        const dominantEmoji = data.moods.find(m => m.mood_name === dominantMood?.[0])?.mood_emoji || "😊";

        return {
          hour: parseInt(hour),
          total_moods: data.count,
          dominant_mood: dominantMood?.[0] || "happy",
          dominant_emoji: dominantEmoji,
        };
      }).sort((a, b) => a.hour - b.hour);

      setTimeStats(timeStatsArray);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Set up real-time updates
    const channel = supabase
      .channel("stats-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "moods",
        },
        () => {
          loadStats(); // Refresh stats when new mood is added
        }
      )
      .subscribe();

    // Refresh every minute
    const interval = setInterval(loadStats, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-mood-button border-border/50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading mood insights...</p>
        </div>
      </Card>
    );
  }

  const getMostCheerfulHour = () => {
    const happyHours = timeStats.filter(stat => 
      ["happy", "excited", "confident"].includes(stat.dominant_mood.toLowerCase())
    );
    if (happyHours.length === 0) return null;
    
    const bestHour = happyHours.reduce((prev, current) => 
      current.total_moods > prev.total_moods ? current : prev
    );
    
    return {
      hour: bestHour.hour,
      emoji: bestHour.dominant_emoji,
      count: bestHour.total_moods
    };
  };

  const cheerfulHour = getMostCheerfulHour();

  return (
    <div className="space-y-6">
      {/* Today's Mood Overview */}
      <Card className="p-6 bg-gradient-mood-button border-border/50">
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Last 48 Hours Global Mood
            </h3>
            <p className="text-2xl font-bold text-foreground">{totalMoods} moods shared</p>
            <p className="text-xs text-muted-foreground">Synced with world map data</p>
          </div>

          {moodStats.length > 0 ? (
            <div className="space-y-3">
              {moodStats.map((mood) => (
                <div key={mood.mood_name} className="flex items-center gap-3">
                  <div className={`text-2xl glow-${mood.mood_color} animate-float`}>
                    {mood.mood_emoji}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-medium mood-${mood.mood_color}`}>
                        {mood.mood_name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {mood.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className={`bg-mood-${mood.mood_color} h-2 rounded-full transition-all duration-500 ease-out glow-${mood.mood_color}`}
                        style={{ width: `${mood.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground min-w-[2rem] text-right">
                    {mood.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">🌅</div>
              <p>No moods shared in the last 48 hours</p>
              <p className="text-sm">Be the first to share your mood!</p>
            </div>
          )}
        </div>
      </Card>

      {/* Insights */}
      {cheerfulHour && (
        <Card className="p-6 bg-gradient-aurora border-border/50">
          <div className="text-center space-y-2">
            <h4 className="text-lg font-semibold text-foreground">💡 Mood Insight</h4>
            <div className="flex items-center justify-center gap-2 text-2xl">
              <span>{cheerfulHour.emoji}</span>
              <span className="text-lg font-medium">
                Most cheerful hour: {cheerfulHour.hour}:00
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {cheerfulHour.count} positive moods shared at this hour
            </p>
          </div>
        </Card>
      )}

      {/* Hourly Activity */}
      {timeStats.length > 0 && (
        <Card className="p-6 bg-gradient-mood-button border-border/50">
          <h4 className="text-lg font-semibold mb-4 text-center">24-Hour Mood Flow</h4>
          <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {Array.from({ length: 24 }, (_, i) => {
              const hourStat = timeStats.find(stat => stat.hour === i);
              return (
                <div key={i} className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">
                    {i.toString().padStart(2, '0')}
                  </div>
                  <div className="h-8 flex items-center justify-center">
                    {hourStat ? (
                      <div className="text-xl animate-pulse-mood" title={`${hourStat.total_moods} moods`}>
                        {hourStat.dominant_emoji}
                      </div>
                    ) : (
                      <div className="w-2 h-2 bg-muted rounded-full opacity-30"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Showing dominant mood per hour (last 48 hours)
          </p>
        </Card>
      )}
    </div>
  );
};