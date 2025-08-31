import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Location = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
  error?: string | null;
};

type LocationContextType = {
  location: Location;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<Location>;
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [location, setLocation] = useState<Location>({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = async (): Promise<Location> => {
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation is not supported by your browser';
      setError(errorMsg);
      return { ...location, error: errorMsg };
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          setLocation(newLocation);
          setLoading(false);
          resolve(newLocation);
        },
        (error) => {
          let errorMsg = 'Unable to retrieve your location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Location permission denied';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMsg = 'Location request timed out';
              break;
          }
          setError(errorMsg);
          setLoading(false);
          resolve({ ...location, error: errorMsg });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  // Request location on mount if not already available
  useEffect(() => {
    if (!location.latitude || !location.longitude) {
      requestLocation().catch(console.error);
    }
  }, []);

  return (
    <LocationContext.Provider value={{ location, loading, error, requestLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
