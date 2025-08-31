import React, { useEffect, useMemo, useRef, useState, useCallback, useContext } from "react";
import { useLocation } from "@/contexts/LocationContext";
import mapboxgl, { Map, LngLatLike, GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Mapbox token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

// ===================== Types =====================
type MoodColor =
  | "red" | "green" | "blue" | "yellow" | "purple" | "pink"
  | "indigo" | "emerald" | "amber" | "rose" | string;

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

// ===================== Utils =====================
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

// Map human mood -> canonical name, emoji, and **mood_color** (string you persist)
const MOOD_PRESETS: Record<string, { name: string; emoji: string; colorKey: MoodColor }> = {
  happy:   { name: "Happy",   emoji: "😊", colorKey: "yellow" },  // <— happy is yellow
  sad:     { name: "Sad",     emoji: "😢", colorKey: "blue"   },
  calm:    { name: "Calm",    emoji: "🧘", colorKey: "emerald"},
  love:    { name: "Love",    emoji: "❤️", colorKey: "rose"   },
  angry:   { name: "Angry",   emoji: "😠", colorKey: "red"    },
  excited: { name: "Excited", emoji: "🤩", colorKey: "indigo" },
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

const escapeHTML = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

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

// ===================== Error Boundary =====================
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  state = { hasError: false, error: undefined };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Map Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          <p className="font-semibold">Something went wrong with the map.</p>
          <p className="text-sm mt-1">Please try refreshing the page.</p>
          {this.state.error && (
            <details className="text-xs mt-2">
              <summary>Error details</summary>
              {this.state.error.message}
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// ===================== Component =====================
export const WorldMoodMap: React.FC<WorldMoodMapProps> = ({ refreshTrigger, onMoodSelect }) => {
  const mapRef = useRef<Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const geolocateRef = useRef<mapboxgl.GeolocateControl | null>(null);

  const [moods, setMoods] = useState<Mood[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userPosition, setUserPosition] = useState<LngLatLike | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // which mood key is saving
  const { toast } = useToast();

  // -------- Load moods from Supabase (last 48h) --------
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

      const clean = (data ?? []).flatMap((m: Mood) => {
        const coord = isValidCoordinate(m.latitude, m.longitude);
        if (!coord) return [];
        return [{ ...m, latitude: coord.lat, longitude: coord.lng }];
      });

      setMoods(clean);
    } catch (e) {
      console.error("Error loading moods:", e);
      toast({ title: "Error", description: "Failed to load mood data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Use location context for user position
  const { location, requestLocation, error: locationError } = useLocation();
  const [showLocationButton, setShowLocationButton] = useState(true);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);

  // Request location on component mount if not already available
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
        const newPosition = { lng: safe.lng, lat: safe.lat };
        setUserPosition([newPosition.lng, newPosition.lat]);
        setLocationAccuracy(location.accuracy || null);
        
        // Center map on user's location if not already centered
        if (mapRef.current) {
          const currentCenter = mapRef.current.getCenter();
          const distance = Math.sqrt(
            Math.pow(currentCenter.lng - newPosition.lng, 2) + 
            Math.pow(currentCenter.lat - newPosition.lat, 2)
          ) * 100; // Rough approximation in kilometers
          
          const zoom = mapRef.current.getZoom();
          
          // Only auto-center if we're far from the user or zoomed out
          if (distance > 100 || zoom < 5) {
            mapRef.current.easeTo({
              center: [newPosition.lng, newPosition.lat],
              zoom: Math.max(zoom, 5), // Don't zoom in too much automatically
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

  // -------- Prepare GeoJSON from moods --------
  const geojson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, any>>(() => ({
    type: "FeatureCollection",
    features: moods.map((m) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.longitude, m.latitude] },
      properties: {
        id: m.id,
        mood_name: m.mood_name,
        mood_emoji: m.mood_emoji,
        note: m.note ?? "",
        color: getColor(m.mood_color),
        created_at: m.created_at,
        raw: m,
      },
    })),
  }), [moods]);

  // -------- Initialize map --------
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

    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false, showZoom: true, visualizePitch: false }), "top-right");

    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { 
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        maximumAge: 0 // Force fresh location
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

    map.on("error", (e) => {
      console.error("Map error:", e.error);
      toast({ title: "Map Error", description: "Failed to load the map. Please check your internet connection.", variant: "destructive" });
    });

    map.on("load", () => {
      setMapReady(true);

      map.addSource("moods", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 8,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "moods",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#64748b", 25, "#4b5563", 75, "#374151"],
          "circle-radius": ["step", ["get", "point_count"], 14, 25, 18, 75, 24],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "moods",
        filter: ["has", "point_count"],
        layout: { "text-field": "{point_count_abbreviated}", "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"], "text-size": 12 },
        paint: { "text-color": "#ffffff", "text-halo-color": "#000000", "text-halo-width": 1 },
      });

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "moods",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      });

      const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, offset: 12, className: "custom-popup" });

      map.on("mouseenter", "unclustered-point", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f || !f.geometry) return;
        const props: any = f.properties ?? {};
        const coords = (f.geometry as any).coordinates?.slice() as [number, number];
        if (!coords) return;

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        const mood = escapeHTML(props.mood_name ?? "");
        const emoji = escapeHTML(props.mood_emoji ?? "");
        const note = escapeHTML(props.note ?? "");
        const created = escapeHTML(props.created_at ?? "");

        popup
          .setLngLat(coords)
          .setHTML(`
            <div class="p-2 min-w-[200px]">
              <div class="flex items-center gap-2">
                <div class="text-2xl">${emoji || "🙂"}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold truncate">${mood || "Mood"}</div>
                  ${note ? `<div class="text-sm text-muted-foreground mt-1 truncate">${note}</div>` : ""}
                  <div class="text-xs text-muted-foreground mt-1">${created ? timeAgo(created) : ""}</div>
                </div>
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseleave", "unclustered-point", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("click", "unclustered-point", (e) => {
        const feature = e.features?.[0];
        if (feature && onMoodSelect) {
          onMoodSelect(feature.properties.raw);
        }
      });

      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource("moods") as GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          const coords = (features[0].geometry as any).coordinates as [number, number];
          map.easeTo({ center: coords, zoom: Math.min(zoom, 15) });
        });
      });

      if (geojson.features.length > 0 && !userPosition) {
        const bounds = new mapboxgl.LngLatBounds();
        geojson.features.forEach((f) => bounds.extend(f.geometry.coordinates as [number, number]));
        if (bounds.getNorth() - bounds.getSouth() > 1 || bounds.getEast() - bounds.getWest() > 1) {
          map.fitBounds(bounds, { padding: 40, duration: 600, maxZoom: 5 });
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => { mapRef.current?.resize(); });
    if (mapContainerRef.current) resizeObserver.observe(mapContainerRef.current);

    loadMoods();

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [geojson, onMoodSelect, toast, userPosition, loadMoods]);

  // -------- Update source data when moods change --------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource("moods") as GeoJSONSource | undefined;
    if (source) source.setData(geojson);
  }, [geojson]);

  // -------- Refresh on trigger --------
  useEffect(() => { loadMoods(); }, [refreshTrigger, loadMoods]);

  // -------- Save mood at current user location --------
  const saveMoodAtUserLocation = useCallback(
    async (key: keyof typeof MOOD_PRESETS, note: string | null = null) => {
      const preset = MOOD_PRESETS[key];
      if (!preset) return;

      // we need a position; try from state, otherwise actively query
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
          // Continue with the flow, error will be handled below
        }
      }

      if (!coords) {
        toast({ title: "Location unavailable", description: "Please enable location permissions and try again.", variant: "destructive" });
        return;
      }

      try {
        setSaving(key);
        // fetch user id if available
        const { data: userRes } = await supabase.auth.getUser();
        const user_id = userRes?.user?.id ?? undefined;

        const payload = {
          mood_emoji: preset.emoji,
          mood_color: preset.colorKey, // this is the string we persist
          mood_name: preset.name,
          latitude: coords[1],
          longitude: coords[0],
          note,
          user_id,
        };

        const { data, error } = await supabase.from("moods").insert(payload).select("*").single();
        if (error) throw error;

        // optimistic update
        if (data) {
          const coord = isValidCoordinate(data.latitude, data.longitude);
          if (coord) {
            const newMood: Mood = {
              ...data,
              latitude: coord.lat,
              longitude: coord.lng,
            };
            setMoods((prev) => [newMood, ...prev]);
      }
    }

    if (!coords) {
      toast({ title: "Location unavailable", description: "Please enable location permissions and try again.", variant: "destructive" });
      return;
    }

    try {
      setSaving(key);
      // fetch user id if available
      const { data: userRes } = await supabase.auth.getUser();
      const user_id = userRes?.user?.id ?? undefined;

      const payload = {
        mood_emoji: preset.emoji,
        mood_color: preset.colorKey, // this is the string we persist
        mood_name: preset.name,
        latitude: coords[1],
        longitude: coords[0],
        note,
        user_id,
      };

      // Optimistic update
      if (data) {
        const coord = isValidCoordinate(data.latitude, data.longitude);
        if (coord) {
          const newMood: Mood = {
            ...data,
            latitude: coord.lat,
            longitude: coord.lng,
          };
          setMoods((prev) => [newMood, ...prev]);
          
          // Fly to the new mood for feedback
          mapRef.current?.flyTo({ 
            center: [coord.lng, coord.lat], 
            zoom: Math.max(mapRef.current.getZoom(), 6), 
            duration: 700 
          });
        }
      }

      toast({ 
        title: "Saved!", 
        description: `Your mood was added at your location.` 
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
  }, [toast, userPosition]);

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
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />
      
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
      {showLocationButton && userPosition && (
        <button
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.flyTo({
                center: userPosition as [number, number],
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

export default WorldMoodMap;
