import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "@/contexts/LocationContext";
import mapboxgl, { Map, LngLatLike, GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Mapbox token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

type MoodColor = "red" | "green" | "blue" | "yellow" | "purple" | "pink" | "indigo" | "emerald" | "amber" | "rose" | string;

interface Mood {
  id: string;
  mood_emoji: string;
  mood_color: MoodColor;
  mood_name: string;
  latitude: number;
  longitude: number;
  note?: string | null;
  created_at: string;
  user_id?: string;
  user_metadata?: {
    email?: string;
    full_name?: string;
    avatar_url?: string;
  };
  updated_at?: string;
}

interface WorldMoodMapProps {
  refreshTrigger?: number;
  onMoodSelect?: (mood: Mood) => void;
}

// Utils
const COLOR_HEX: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  purple: "#a855f7",
  pink: "#ec4899",
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  default: "#6b7280",
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const normalizeLng = (lng: number) => ((lng % 360) + 540) % 360 - 180;

const isValidCoordinate = (lat: unknown, lng: unknown) => {
  const nlat = Number(lat);
  const nlng = Number(lng);
  if (Number.isNaN(nlat) || Number.isNaN(nlng)) return null;
  const clampedLat = clamp(nlat, -85, 85);
  const normLng = normalizeLng(nlng);
  if (clampedLat < -85 || clampedLat > 85 || normLng < -180 || normLng > 180) return null;
  return { lat: clampedLat, lng: normLng };
};

const getColor = (c: string) => COLOR_HEX[c] ?? COLOR_HEX.default;

const timeAgo = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  const units: [number, string][] = [
    [31536000, "year"], [2592000, "month"], [86400, "day"],
    [3600, "hour"], [60, "minute"],
  ];
  for (const [s, label] of units) {
    const i = Math.floor(sec / s);
    if (i >= 1) return `${i} ${label}${i === 1 ? "" : "s"} ago`;
  }
  return "just now";
};

// Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  state = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Map error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-red-50">
          <div className="text-center p-4">
            <h3 className="text-lg font-medium text-red-800">Map Error</h3>
            <p className="text-sm text-red-600">Failed to load the map. Please refresh the page.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Mood Presets
const MOOD_PRESETS = {
  happy: { emoji: '😊', name: 'Happy', color: 'yellow' },
  sad: { emoji: '😢', name: 'Sad', color: 'red' },
  angry: { emoji: '😠', name: 'Angry', color: 'darkred' },
  excited: { emoji: '🤩', name: 'Excited', color: 'gold' },
  grateful: { emoji: '🙏', name: 'Grateful', color: 'green' },
};

type MoodKey = keyof typeof MOOD_PRESETS;

// Main Component
export const WorldMoodMap: React.FC<WorldMoodMapProps> = ({ refreshTrigger, onMoodSelect }) => {
  const mapRef = useRef<Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const geolocateRef = useRef<mapboxgl.GeolocateControl | null>(null);
  const { toast } = useToast();
  
  const [moods, setMoods] = useState<Mood[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [saving, setSaving] = useState<MoodKey | null>(null);

  // Load moods from Supabase
  const loadMoods = useCallback(async () => {
    try {
      setIsLoading(true);
      const last48Hours = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("moods")
        .select("*")
        .gte("created_at", last48Hours)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) throw error;

      const cleanMoods = (data || []).flatMap((m: Mood) => {
        const coord = isValidCoordinate(m.latitude, m.longitude);
        if (!coord) return [];
        return [{ ...m, latitude: coord.lat, longitude: coord.lng }];
      });

      setMoods(cleanMoods);
    } catch (e) {
      console.error("Error loading moods:", e);
      toast({ title: "Error", description: "Failed to load mood data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Use location context for user position
  const { location, requestLocation, error: locationError } = useLocation();

  // Request location on mount
  useEffect(() => {
    if (!location.latitude || !location.longitude) {
      requestLocation().catch(console.error);
    }
  }, []);

  // Update user position when location changes
  useEffect(() => {
    if (location.latitude && location.longitude) {
      const safe = isValidCoordinate(location.latitude, location.longitude);
      if (safe) {
        const newPosition: [number, number] = [safe.lng, safe.lat];
        setUserPosition(newPosition);
        setLocationAccuracy(location.accuracy || null);

        if (mapRef.current) {
          const currentCenter = mapRef.current.getCenter();
          const distance = Math.sqrt(
            Math.pow(currentCenter.lng - safe.lng, 2) + 
            Math.pow(currentCenter.lat - safe.lat, 2)
          ) * 100; // Rough km approximation
          
          const zoom = mapRef.current.getZoom();
          
          if (distance > 100 || zoom < 5) {
            mapRef.current.easeTo({
              center: newPosition,
              zoom: Math.max(zoom, 5),
              duration: 1000,
              essential: true
            });
          }
        }
      }
    }
  }, [location]);

  // Handle location errors
  useEffect(() => {
    if (locationError) {
      toast({
        title: "Location Error",
        description: locationError,
        variant: "destructive",
        duration: 5000
      });
    }
  }, [locationError, toast]);

  // Save mood at current location
  const saveMoodAtUserLocation = useCallback(
    async (key: MoodKey, note: string | null = null) => {
      const preset = MOOD_PRESETS[key];
      if (!preset) return;

      // Try to get user position from state or geolocation
      let coords = userPosition as [number, number] | null;
      let position: GeolocationPosition | null = null;

      if (!coords && "geolocation" in navigator) {
        try {
          position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              enableHighAccuracy: true, 
              timeout: 8000 
            });
          });
          
          if (position) {
            const safe = isValidCoordinate(
              position.coords.latitude, 
              position.coords.longitude
            );
            if (safe) coords = [safe.lng, safe.lat];
          }
        } catch (err) {
          console.error("Error getting geolocation:", err);
        }
      }

      if (!coords) {
        toast({ 
          title: "Location unavailable", 
          description: "Please enable location permissions and try again.", 
          variant: "destructive" 
        });
        return;
      }

      try {
        setSaving(key);
        
        // Get current user if available
        const { data: { user } } = await supabase.auth.getUser();
        
        const payload = {
          mood_emoji: preset.emoji,
          mood_color: preset.color,
          mood_name: preset.name,
          latitude: coords[1],
          longitude: coords[0],
          note: note,
          user_id: user?.id,
        };

        const { data, error } = await supabase
          .from('moods')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        // Optimistic update
        if (data) {
          const coord = isValidCoordinate(data.latitude, data.longitude);
          if (coord) {
            const newMood: Mood = {
              ...data,
              latitude: coord.lat,
              longitude: coord.lng,
            };
            setMoods(prev => [newMood, ...prev]);
            
            // Fly to the new mood for feedback
            mapRef.current?.flyTo({ 
              center: [coord.lng, coord.lat], 
              zoom: Math.max(mapRef.current.getZoom() || 10, 6), 
              duration: 700 
            });
          }
        }

        toast({ 
          title: "Saved!", 
          description: `${preset.name} mood was added at your location.` 
        });
      } catch (error: any) {
        console.error("Save mood error:", error);
        toast({ 
          title: "Could not save mood", 
          description: error?.message ?? "Unknown error", 
          variant: "destructive" 
        });
      } finally {
        setSaving(null);
      }
    },
    [toast, userPosition]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [0, 20],
      zoom: 1.8,
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: false,
    });

    mapRef.current = map;

    // Add map controls
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.addControl(
      new mapboxgl.NavigationControl({ 
        showCompass: false, 
        showZoom: true, 
        visualizePitch: false 
      }), 
      "top-right"
    );

    // Add geolocation control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { 
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true,
      fitBoundsOptions: { 
        maxZoom: 14,
        padding: 100
      },
      showUserLocation: true
    });
    
    geolocateRef.current = geolocate;
    map.addControl(geolocate, "top-right");

    // Handle map errors
    map.on("error", (e) => {
      console.error("Map error:", e.error);
      toast({ 
        title: "Map Error", 
        description: "Failed to load the map. Please check your internet connection.", 
        variant: "destructive" 
      });
    });

    map.on("load", () => {
      setMapReady(true);
      loadMoods();
    });

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loadMoods, toast]);

  // Update map with moods data
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    
    const map = mapRef.current;
    
    // Create GeoJSON source from moods
    const geojson = {
      type: 'FeatureCollection' as const,
      features: moods.map(mood => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [mood.longitude, mood.latitude]
        },
        properties: {
          id: mood.id,
          emoji: mood.mood_emoji,
          color: mood.mood_color,
          name: mood.mood_name,
          note: mood.note,
          createdAt: mood.created_at,
          userId: mood.user_id
        }
      }))
    };

    // Add or update source
    const source = map.getSource('moods') as GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    } else if (map.isStyleLoaded()) {
      map.addSource('moods', {
        type: 'geojson',
        data: geojson
      });

      // Add heatmap layer
      map.addLayer({
        id: 'mood-heatmap',
        type: 'heatmap',
        source: 'moods',
        maxzoom: 9,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'point_count'], 0, 0, 100, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(33,102,172,0)',
            0.2, 'rgb(103,169,207)',
            0.4, 'rgb(209,229,240)',
            0.6, 'rgb(253,219,199)',
            0.8, 'rgb(239,138,98)',
            1, 'rgb(178,24,43)'
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9, 0]
        }
      });

      // Add circle layer for points with glow effect
      map.addLayer({
        id: 'mood-points-glow',
        type: 'circle',
        source: 'moods',
        minzoom: 5,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 8, 10, 16],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.2,
          'circle-stroke-width': 0
        }
      });

      // Add circle layer for points
      map.addLayer({
        id: 'mood-points',
        type: 'circle',
        source: 'moods',
        minzoom: 5,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 10, 12],
          'circle-color': [
            'match',
            ['get', 'emoji'],
            '😊', COLOR_HEX.yellow,  // Yellow for Happy
            '😢', '#ef4444',         // Red for Sad
            '😠', '#8B0000',         // Dark Red for Angry
            '🤩', '#FFD700',         // Gold for Excited
            '🙏', COLOR_HEX.green,   // Green for Grateful
            COLOR_HEX.default
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9
        }
      });

      // Add symbol layer for emojis
      map.addLayer({
        id: 'mood-labels',
        type: 'symbol',
        source: 'moods',
        minzoom: 5,
        layout: {
          'text-field': ['get', 'emoji'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 14, 10, 18],
          'text-allow-overlap': true
        }
      });
    }
  }, [moods, mapReady]);

  // Handle zoom/heatmap layer visibility
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    
    const map = mapRef.current;
    const updateLayerVisibility = () => {
      const zoom = map.getZoom();
      const heatmapVisibility = zoom < 8 ? "visible" : "none";
      if (map.getLayer("mood-heatmap")) {
        map.setLayoutProperty("mood-heatmap", "visibility", heatmapVisibility);
      }
    };

    map.on('zoom', updateLayerVisibility);
    updateLayerVisibility();
    
    return () => {
      map.off('zoom', updateLayerVisibility);
    };
  }, [mapReady]);

  // Handle refresh trigger
  useEffect(() => {
    if (refreshTrigger && mapReady) {
      loadMoods();
    }
  }, [refreshTrigger, mapReady, loadMoods]);

  // Handle mood selection
  const handleMoodSelect = useCallback((mood: Mood) => {
    if (onMoodSelect) {
      onMoodSelect(mood);
    }
  }, [onMoodSelect]);

  // Render loading state if no Mapbox token
  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full bg-muted/50 flex items-center justify-center p-6">
        <div className="bg-background p-6 rounded-lg shadow-lg max-w-md text-center">
          <h3 className="text-lg font-semibold mb-2">Mapbox Token Required</h3>
          <p className="text-sm text-muted-foreground">
            Please set the{' '}
            <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
              VITE_MAPBOX_TOKEN
            </code>{' '}
            environment variable to display the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-full h-[70vh] min-h-[500px] relative bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
        <div 
          ref={mapContainerRef} 
          className="w-full h-full"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          }}
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
        
        {/* Location accuracy indicator */}
        {locationAccuracy !== null && (
          <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full z-10 backdrop-blur-sm">
            Accuracy: ~{Math.round(locationAccuracy)}m
          </div>
        )}
        
        {/* Center on location button */}
        {userPosition && (
          <button
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.flyTo({
                  center: userPosition,
                  zoom: Math.max(mapRef.current.getZoom(), 10),
                  speed: 1.2,
                  curve: 1.42,
                  essential: true
                });
              }
            }}
            className="absolute bottom-4 right-4 bg-white p-2 rounded-full shadow-lg z-10 hover:bg-gray-100 transition-colors"
            aria-label="Center on my location"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8ZM20.94 11C20.48 6.83 17.17 3.52 13 3.06V1H11V3.06C6.83 3.52 3.52 6.83 3.06 11H1V13H3.06C3.52 17.17 6.83 20.48 11 20.94V23H13V20.94C17.17 20.48 20.48 17.17 20.94 13H23V11H20.94ZM12 19C8.13 19 5 15.87 5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12C19 15.87 15.87 19 12 19Z" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default WorldMoodMap;
