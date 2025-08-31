'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// This is a minimal test component to verify Mapbox setup
// Replace with your actual token in .env file
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// Set the access token
mapboxgl.accessToken = MAPBOX_TOKEN;

export default function SimpleMapTest() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    // Don't initialize if we don't have a container or token
    if (!mapContainer.current || !MAPBOX_TOKEN) {
      console.error('Missing map container or Mapbox token');
      return;
    }

    try {
      // Initialize the map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12', // Use a basic style
        center: [-74.5, 40], // Default center (New York)
        zoom: 9,
      });

      // Add a single marker
      marker.current = new mapboxgl.Marker()
        .setLngLat([-74.5, 40])
        .addTo(map.current);

      // Add basic navigation controls
      map.current.addControl(new mapboxgl.NavigationControl());

      // Handle map load event
      map.current.on('load', () => {
        console.log('Map loaded successfully');
      });

      // Handle errors
      map.current.on('error', (e) => {
        console.error('Map error:', e.error);
      });

    } catch (error) {
      console.error('Failed to initialize map:', error);
    }

    // Cleanup function
    return () => {
      if (marker.current) {
        marker.current.remove();
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        <h3 className="font-bold">Mapbox Token Missing</h3>
        <p>Please add your Mapbox token to the .env file as VITE_MAPBOX_TOKEN</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full border rounded-lg overflow-hidden">
      <div 
        ref={mapContainer} 
        className="h-full w-full"
        aria-label="Simple Map Test"
      />
    </div>
  );
}
