import { Geolocation as CapacitorGeolocation } from '@capacitor/geolocation';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp?: number;
  error?: string;
}

const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export const requestLocationPermissions = async () => {
  try {
    // First try using Capacitor's geolocation
    if (typeof CapacitorGeolocation !== 'undefined') {
      const permissionStatus = await CapacitorGeolocation.checkPermissions();
      if (permissionStatus.location === 'granted') {
        return { granted: true };
      }
      
      const result = await CapacitorGeolocation.requestPermissions();
      return { granted: result.location === 'granted' };
    }

    // Fallback to web geolocation API
    if (navigator.permissions) {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (status.state === 'denied') {
        throw new Error('PERMISSION_DENIED');
      }
    }

    // Try to get the current position to trigger the permission prompt
    await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            reject(new Error('PERMISSION_DENIED'));
          } else {
            // For other errors, we still return granted: true
            resolve({} as GeolocationPosition);
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });

    return { granted: true };
  } catch (error: any) {
    console.error('Location permission error:', error);
    
    const message = isIOS() || isSafari()
      ? 'To enable location access:\n' +
        '1. Open Settings > Privacy > Location Services\n' +
        '2. Make sure Location Services is ON\n' +
        '3. Find this app in the list and select "While Using"\n' +
        '4. Refresh the page after changing settings'
      : 'Please enable location access in your browser settings. ' +
        'Look for a location permission prompt or check your browser settings.';
    
    return { 
      granted: false, 
      message,
      isSafari: isSafari() || isIOS()
    };
  }
};

export const getCurrentLocation = async (): Promise<Location> => {
  try {
    // Try using Capacitor first
    if (typeof CapacitorGeolocation !== 'undefined') {
      const position = await CapacitorGeolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude ?? null,
        altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
        heading: position.coords.heading ?? null,
        speed: position.coords.speed ?? null,
        timestamp: position.timestamp
      };
    }

    // Fallback to web geolocation API
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          let errorMessage = 'Failed to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          reject(new Error(errorMessage));
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 0 
        }
      );
    });
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude ?? null,
      altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
      heading: position.coords.heading ?? null,
      speed: position.coords.speed ?? null,
      timestamp: position.timestamp
    };
  } catch (error: any) {
    console.error('Failed to get location:', error);
    throw error;
  }
};

export const watchPosition = (
  onPosition: (position: Location) => void,
  onError?: (error: any) => void
): (() => void) => {
  // For Capacitor
  if (typeof CapacitorGeolocation !== 'undefined') {
    let watchId: string | undefined;
    
    // Wrap in a Promise to handle the async nature of Capacitor's watchPosition
    const watchPromise = CapacitorGeolocation.watchPosition(
      { enableHighAccuracy: true },
      (position, error) => {
        if (error) {
          console.error('Location watch error:', error);
          if (onError) onError(error);
          return;
        }
        
        if (position) {
          onPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude ?? null,
            altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
            heading: position.coords.heading ?? null,
            speed: position.coords.speed ?? null,
            timestamp: position.timestamp
          });
        }
      }
    ) as Promise<string>;

    // Set the watchId when the Promise resolves
    watchPromise.then(id => {
      watchId = id;
    }).catch(error => {
      console.error('Failed to start watching position:', error);
      if (onError) onError(error);
    });

    return () => {
      if (watchId) {
        CapacitorGeolocation.clearWatch({ id: watchId });
      }
    };
  }

  // Fallback to web geolocation API
  let watchId: number;
  
  requestLocationPermissions()
    .then(({ granted }) => {
      if (!granted) {
        throw new Error('Location permission not granted');
      }
      
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          onPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude ?? null,
            altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
            heading: position.coords.heading ?? null,
            speed: position.coords.speed ?? null,
            timestamp: position.timestamp
          });
        },
        (error) => {
          console.error('Location watch error:', error);
          if (onError) onError(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    })
    .catch((error) => {
      console.error('Failed to start location watch:', error);
      if (onError) onError(error);
    });

  return () => {
    if (watchId !== undefined) {
      navigator.geolocation.clearWatch(watchId);
    }
  };
};
