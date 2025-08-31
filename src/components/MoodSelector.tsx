import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MoodOption {
  id: string;
  emoji: string;
  name: string;
  color: string;
  description: string;
}

const moodOptions: MoodOption[] = [
  { id: "happy", emoji: "😊", name: "Happy", color: "#FFD700", description: "Joyful and content" },
  { id: "sad", emoji: "😢", name: "Sad", color: "#1E90FF", description: "Feeling down or blue" },
  { id: "angry", emoji: "😠", name: "Angry", color: "#FF4500", description: "Frustrated or upset" },
  { id: "calm", emoji: "😌", name: "Calm", color: "#90EE90", description: "Peaceful and relaxed" },
  { id: "energetic", emoji: "⚡", name: "Energetic", color: "#FFA500", description: "Full of energy" },
  { id: "excited", emoji: "🤩", name: "Excited", color: "#FF69B4", description: "Thrilled and enthusiastic" },
  { id: "creative", emoji: "🎨", name: "Creative", color: "#9932CC", description: "Inspired and imaginative" },
  { id: "confident", emoji: "💪", name: "Confident", color: "#4B0082", description: "Self-assured and bold" },
  { id: "peaceful", emoji: "🕊️", name: "Peaceful", color: "#87CEEB", description: "Serene and tranquil" },
  { id: "passionate", emoji: "🔥", name: "Passionate", color: "#FF0000", description: "Intense and driven" },
];

interface MoodSelectorProps {
  onMoodShared?: () => void;
}

export const MoodSelector = ({ onMoodShared }: MoodSelectorProps) => {
  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null);
  const [note, setNote] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  const getUserLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          // Fallback to random global location if user denies location
          resolve({
            latitude: Math.random() * 180 - 90,
            longitude: Math.random() * 360 - 180,
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  const handleShareMood = async () => {
    if (!selectedMood) return;

    setIsSharing(true);
    try {
      const location = await getUserLocation();
      
      const { error } = await supabase
        .from("moods")
        .insert({
          mood_emoji: selectedMood.emoji,
          mood_color: selectedMood.color,
          mood_name: selectedMood.name,
          latitude: location.latitude,
          longitude: location.longitude,
          note: note.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Mood shared! ✨",
        description: `Your ${selectedMood.name.toLowerCase()} mood is now glowing on the world map`,
      });

      setSelectedMood(null);
      setNote("");
      onMoodShared?.();
    } catch (error) {
      console.error("Error sharing mood:", error);
      toast({
        title: "Failed to share mood",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  if (selectedMood) {
    return (
      <Card className="p-6 bg-gradient-mood-button border-border/50 backdrop-blur-sm animate-fade-in">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <div className={`text-6xl animate-float glow-${selectedMood.color}`}>
              {selectedMood.emoji}
            </div>
            <h3 className={`text-2xl font-bold mood-${selectedMood.color}`}>
              Feeling {selectedMood.name}
            </h3>
            <p className="text-muted-foreground">{selectedMood.description}</p>
          </div>

          <div className="space-y-4">
            <Textarea
              placeholder="Add a note about your mood (optional, max 100 characters)"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 100))}
              className="resize-none bg-background/50 border-border/50"
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {note.length}/100
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setSelectedMood(null)}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleShareMood}
              disabled={isSharing}
              className={`flex-1 bg-mood-${selectedMood.color} hover:bg-mood-${selectedMood.color}/90 text-background font-semibold transition-all duration-300 hover:scale-105 glow-${selectedMood.color}`}
            >
              {isSharing ? "Sharing..." : "Share Your Mood ✨"}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-mood-button border-border/50 backdrop-blur-sm">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            What's your mood?
          </h2>
          <p className="text-muted-foreground">
            Share how you're feeling with the world
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {moodOptions.map((mood) => (
            <Button
              key={mood.id}
              variant="outline"
              onClick={() => setSelectedMood(mood)}
              className="h-16 flex flex-col gap-1 transition-all duration-300 hover:scale-105 group"
            >
              <span className="text-2xl group-hover:animate-float">{mood.emoji}</span>
              <span className="text-sm font-medium">
                {mood.name}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
};