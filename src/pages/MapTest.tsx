import SimpleMapTest from '@/components/SimpleMapTest';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function MapTestPage() {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Mapbox Test</CardTitle>
          <CardDescription>
            This is a test page to verify Mapbox integration.
            If you can see a map with a marker below, Mapbox is working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleMapTest />
          
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Troubleshooting:</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>If you see an error about the token, check your <code>.env</code> file</li>
              <li>Make sure you have <code>VITE_MAPBOX_TOKEN=your_token_here</code> in your <code>.env</code> file</li>
              <li>Verify the token is valid and has the correct permissions</li>
              <li>Check the browser console for any error messages (F12 or right-click → Inspect → Console)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
