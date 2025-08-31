'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export default function MapboxTest() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !mapboxgl.accessToken) return;

    try {
      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-74.5, 40], // Default center
        zoom: 9
      });

      // Add a marker
      marker.current = new mapboxgl.Marker()
        .setLngLat([-74.5, 40])
        .addTo(map.current);

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl());

      // Handle errors
      map.current.on('error', (e) => {
        console.error('Map error:', e.error);
      });
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }

    // Cleanup
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

  return (
    <div className="h-[500px] w-full rounded-lg overflow-hidden border">
      {!mapboxgl.accessToken ? (
        <div className="h-full flex items-center justify-center bg-red-50 text-red-600">
          Error: Mapbox token is missing. Please check your .env file.
        </div>
      ) : (
        <div 
          ref={mapContainer} 
          className="h-full w-full"
          aria-label="Mapbox Test Map"
        />
      )}
    </div>
  );
}
