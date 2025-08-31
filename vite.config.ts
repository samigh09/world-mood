import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from 'fs';
import os from 'os';

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const isDev = mode === 'development';
  
  const serverConfig: any = {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: true,
  };

  // Configure server for network access
  if (isDev) {
    serverConfig.host = '0.0.0.0'; // Listen on all network interfaces
    serverConfig.cors = true;
    serverConfig.headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    };
    
    // Get local IP address for network access
    const networkInterfaces = os.networkInterfaces();
    const localIp = Object.values(networkInterfaces)
      .flat()
      .find((iface) => 
        iface && 
        'family' in iface && 
        'address' in iface &&
        iface.family === 'IPv4' && 
        !iface.internal
      )?.address;
    
    if (localIp) {
      console.log(`\n  Local:    http://localhost:${serverConfig.port}`);
      console.log(`  Network:  http://${localIp}:${serverConfig.port}\n`);
    }
  }

  return {
    server: serverConfig,
    preview: {
      port: 5173,
      strictPort: true,
    },
    plugins: [
      react(),
      isDev && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: [
        {
          find: "@",
          replacement: path.resolve(__dirname, "./src"),
        },
      ],
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2020',
      },
    },
    build: {
      target: 'es2020',
    },
  };
});
