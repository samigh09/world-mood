import React, { useState, useEffect, useCallback } from 'react';
import { getCurrentLocation, watchPosition, requestLocationPermissions, Location } from '../services/simpleLocation';

interface LocationTrackerProps {
  onLocationUpdate: (location: Location) => void;
  isWatching?: boolean;
  watchOptions?: PositionOptions;
}

const LocationTracker: React.FC<LocationTrackerProps> = ({
  onLocationUpdate,
  isWatching = false,
  watchOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
}) => {
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isWatchingState, setIsWatching] = useState<boolean>(isWatching);
  const [cleanupWatch, setCleanupWatch] = useState<(() => void) | null>(null);

  // Check if we're in a secure context (HTTPS or localhost)
  const isSecureContext = window.isSecureContext || 
                         window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';

  // Check if we're on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Check permission status
  const checkPermissionStatus = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        setPermissionStatus(status.state);
        
        status.onchange = () => {
          setPermissionStatus(status.state);
        };
      }
    } catch (error) {
      console.error('Error checking permission status:', error);
    }
  }, []);

  // Handle location updates
  const handleLocationUpdate = useCallback((newLocation: Location) => {
    setLocation(newLocation);
    onLocationUpdate(newLocation);
    setError(null);
    setIsLoading(false);
  }, [onLocationUpdate]);

  // Handle location errors
  const handleLocationError = useCallback((error: Error) => {
    console.error('Location error:', error);
    
    let errorMessage = error.message || 'Failed to get location';
    
    if (error.message.includes('PERMISSION_DENIED') || error.message.toLowerCase().includes('permission')) {
      errorMessage = 'Location permission denied. Please enable location access in your browser or device settings.';
      if (isIOS) {
        errorMessage += '\nOn iOS, go to Settings > Privacy > Location Services and enable it for this app.';
      }
    } else if (error.message.includes('unavailable')) {
      errorMessage = 'Location information is unavailable. Please check your device location settings.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Location request timed out. Please try again.';
    }
    
    setError(errorMessage);
    setIsLoading(false);
  }, [isIOS]);

  // Get current location
  const getCurrentLocationCallback = useCallback(async () => {
    if (!isSecureContext) {
      setError('Location access requires a secure context (HTTPS or localhost)');
      return;
    }

    setIsLoading(true);
    
    try {
      // First check permissions
      const { granted, message } = await requestLocationPermissions();
      
      if (!granted) {
        throw new Error(message || 'Location permission not granted');
      }
      
      // Then get the location
      const currentLocation = await getCurrentLocation();
      handleLocationUpdate(currentLocation);
    } catch (error: any) {
      handleLocationError(error);
      
      // Auto-retry for certain errors
      if (error.message.includes('timeout') && retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          getCurrentLocationCallback();
        }, 2000);
      }
    }
  }, [handleLocationUpdate, handleLocationError, isSecureContext, retryCount]);

  // Start/stop watching position
  useEffect(() => {
    if (!isWatchingState || !isSecureContext) {
      return;
    }

    let mounted = true;
    let watchCleanup: (() => void) | null = null;

    const startWatching = async () => {
      try {
        // First check permissions
        const { granted, message } = await requestLocationPermissions();
        
        if (!granted) {
          throw new Error(message || 'Location permission not granted');
        }

        // Then start watching
        watchCleanup = watchPosition(
          handleLocationUpdate,
          (error) => handleLocationError(error as Error)
        );

        if (mounted) {
          setCleanupWatch(() => watchCleanup || (() => {}));
        }
      } catch (error: any) {
        handleLocationError(error);
      }
    };

    startWatching();

    return () => {
      mounted = false;
      if (watchCleanup) {
        watchCleanup();
      }
    };
  }, [isWatchingState, handleLocationUpdate, handleLocationError, isSecureContext]);

  // Initial load
  useEffect(() => {
    checkPermissionStatus();
    
    if (!isWatchingState) {
      getCurrentLocationCallback();
    }
    
    return () => {
      if (cleanupWatch) {
        cleanupWatch();
      }
    };
  }, [checkPermissionStatus, getCurrentLocationCallback, isWatchingState, cleanupWatch]);

  // Toggle watching state
  const toggleWatching = useCallback(() => {
    if (isWatchingState) {
      if (cleanupWatch) {
        cleanupWatch();
        setCleanupWatch(null);
      }
      setIsWatching(false);
    } else {
      setIsWatching(true);
    }
  }, [isWatchingState, cleanupWatch]);

  // Render error message if not in a secure context
  if (!isSecureContext) {
    return (
      <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
        <p className="font-medium text-yellow-800">Location access requires a secure context (HTTPS or localhost).</p>
        <p className="text-yellow-700">Please access this page via HTTPS or localhost to enable location features.</p>
      </div>
    );
  }

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

  // Render error message if any
  if (error) {
    return (
      <div className="p-4 bg-red-50 border-l-4 border-red-400">
        <p className="font-medium text-red-800">Location Error</p>
        <p className="text-red-700 whitespace-pre-line">{error}</p>
        <button 
          onClick={getCurrentLocationCallback}
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
              <li>Make sure Location Services is ON</li>
              <li>Find this app in the list and select &quot;While Using&quot;</li>
              <li>Refresh this page</li>
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

  // Render location data if available
  return (
    <div className="space-y-4">
      {location && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-900">Your Location</h3>
            <button
              onClick={getCurrentLocationCallback}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-amber-700 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
            >
              {isLoading ? 'Updating...' : 'Update'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Latitude</div>
              <div className="mt-1 text-lg font-mono">{location.latitude?.toFixed(6)}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Longitude</div>
              <div className="mt-1 text-lg font-mono">{location.longitude?.toFixed(6)}</div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            {location.accuracy && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</div>
                <div className="mt-1 text-sm">±{Math.round(location.accuracy)} meters</div>
              </div>
            )}
            {location.altitude && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Altitude</div>
                <div className="mt-1 text-sm">{Math.round(location.altitude)} meters</div>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex">
            <button
              onClick={toggleWatching}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors flex items-center justify-center ${
                isWatchingState
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isWatchingState ? (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Live Tracking
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Start Live Tracking
                </>
              )}
            </button>
          </div>
          
          {location.timestamp && (
            <div className="mt-3 text-xs text-gray-500 text-right">
              Updated: {new Date(location.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationTracker;
