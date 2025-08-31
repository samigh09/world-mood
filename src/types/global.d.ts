import '@capacitor/core';

declare global {
  interface Window {
    Capacitor: {
      isNativePlatform: () => boolean;
    };
  }

  // Add type for Capacitor's Position to match GeolocationPosition
  interface Position extends GeolocationPosition {
    coords: GeolocationCoordinates;
    timestamp: number;
  }
}
