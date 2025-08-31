import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getCurrentLocation as getCurrentLocationService, 
  watchPosition, 
  requestLocationPermissions, 
  Location
} from '../services/simpleLocation';

// Helper function to format coordinates
const formatCoordinate = (value: number | undefined): string => {
  if (value === undefined) return '--';
  return value.toFixed(6);
};

interface LocationTrackerProps {
  onLocationUpdate: (location: Location) => void;
  isWatching?: boolean;
  watchOptions?: PositionOptions;
}

type PermissionStatus = 'granted' | 'denied' | 'prompt';

const NewLocationTracker: React.FC<LocationTrackerProps> = ({
  onLocationUpdate,
  isWatching = false,
  watchOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
}): JSX.Element => {
  // State management
  const isMounted = useRef(true);
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('prompt');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isWatchingState, setIsWatching] = useState<boolean>(isWatching);
  const [cleanupWatch, setCleanupWatch] = useState<(() => void) | null>(null);

  // Check if we're in a secure context (HTTPS or localhost)
  const isSecureContext = window.isSecureContext || 
                         window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
  
  // Check if running on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Handle location updates
  const handleLocationUpdate = useCallback((newLocation: Location) => {
    if (!isMounted.current) return;
    setLocation(newLocation);
    onLocationUpdate(newLocation);
    setError(null);
    setIsLoading(false);
  }, [onLocationUpdate]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    if (!isMounted.current) return;
    console.error('Location error:', error);
    setError(error.message || 'Failed to get location');
    setIsLoading(false);
  }, []);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    if (!isMounted.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const currentLocation = await getCurrentLocationService();
      handleLocationUpdate(currentLocation);
    } catch (error) {
      handleError(error as Error);
    }
  }, [handleLocationUpdate, handleError]);

  // Toggle watching location
  const toggleWatching = useCallback(() => {
    if (!isMounted.current) return;
    
    if (isWatchingState) {
      // Stop watching
      if (cleanupWatch) {
        cleanupWatch();
        setCleanupWatch(null);
      }
    } else {
      // Start watching
      const cleanup = watchPosition(
        handleLocationUpdate,
        handleError
      );
      setCleanupWatch(() => cleanup);
    }
    
    setIsWatching(!isWatchingState);
  }, [isWatchingState, cleanupWatch, handleLocationUpdate, handleError, watchOptions]);

  // Check permission status
  const checkPermissionStatus = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (isMounted.current) {
          setPermissionStatus(status.state as PermissionStatus);
        }
        
        status.onchange = () => {
          if (isMounted.current) {
            setPermissionStatus(status.state as PermissionStatus);
          }
        };
      }
    } catch (error) {
      console.error('Error checking permission status:', error);
      if (isMounted.current) {
        setPermissionStatus('prompt');
      }
    }
  }, []);

  // Initial setup
  useEffect(() => {
    checkPermissionStatus();
    getCurrentLocation();
    
    return () => {
      isMounted.current = false;
      if (cleanupWatch) {
        cleanupWatch();
      }
    };
  }, [checkPermissionStatus, getCurrentLocation, cleanupWatch]);

  // Handle retry
  useEffect(() => {
    if (retryCount > 0) {
      const timer = setTimeout(() => {
        getCurrentLocation();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [retryCount, getCurrentLocation]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="p-4 bg-blue-50 text-blue-800 flex items-center">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Getting your location...</span>
      </div>
    );
  }

  // Render error message if not in a secure context
  if (!isSecureContext) {
    return (
      <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
        <p className="font-medium text-yellow-800">Location access requires a secure context (HTTPS or localhost).</p>
        <p className="text-yellow-700">Please access this page via HTTPS or localhost to enable location features.</p>
      </div>
    );
  }

  // Render error message if any
  if (error) {
    return (
      <div className="p-4 bg-red-50 border-l-4 border-red-400">
        <p className="font-medium text-red-800">Location Error</p>
        <p className="text-red-700 whitespace-pre-line">{error}</p>
        <button 
          onClick={getCurrentLocation}
          className="mt-2 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Render permission prompt if needed
  if (permissionStatus === 'denied') {
    return (
      <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
        <p className="font-medium text-yellow-800">Location permission is required to use this feature.</p>
        <p className="text-yellow-700 mb-4">Please enable location access in your browser settings and refresh the page.</p>
        
        {isIOS && (
          <div className="bg-white p-3 rounded-md border border-yellow-200 mb-4">
            <p className="font-medium text-yellow-800 mb-2">On iOS, follow these steps:</p>
            <ol className="list-decimal pl-5 space-y-1 text-yellow-700">
              <li>Open Settings &gt; Privacy &gt; Location Services</li>
              <li>Find this app in the list and select "While Using"</li>
            </ol>
          </div>
        )}
        
        <button 
          onClick={checkPermissionStatus}
          className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors"
        >
          I've enabled location access
        </button>
      </div>
    );
  }

  // Render location data
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">Current Location</h3>
        {location ? (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Latitude:</span> {formatCoordinate(location.latitude)}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Longitude:</span> {formatCoordinate(location.longitude)}
            </p>
            {location.altitude !== undefined && location.altitude !== null && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Altitude:</span> {formatCoordinate(location.altitude)} m
              </p>
            )}
            {location.accuracy !== undefined && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Accuracy:</span> {Math.round(location.accuracy)} m
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Last updated: {location.timestamp ? new Date(location.timestamp).toLocaleTimeString() : '--'}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">No location data available</p>
        )}
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={getCurrentLocation}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Updating...' : 'Update Location'}
        </button>
        
        <button
          onClick={toggleWatching}
          className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isWatchingState
              ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500'
              : 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-500'
          }`}
        >
          {isWatchingState ? 'Stop Watching' : 'Watch Location'}
        </button>
      </div>
    </div>
  );
};

export default NewLocationTracker;
