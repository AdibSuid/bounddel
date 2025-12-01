'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar/Sidebar';
import MapWrapper from '@/components/Map';
import DrawingControls from '@/components/DrawingControls';
import { Layer, DrawingMode, BoundingBox } from '@/lib/types';
import { models } from '@/lib/mockData';
import bbox from '@turf/bbox';
import { delineateFields, validateBBox } from '@/lib/delineateAnything';

export default function Home() {
    const [mapVisible, setMapVisible] = useState(true);
    const [baseLayer, setBaseLayer] = useState('esri');
  // Initialize layers as empty - will only populate when user uploads files
  const [layers, setLayers] = useState<Layer[]>([]);

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFeatureBounds, setSelectedFeatureBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);



  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: React.MouseEvent) => {
    if (isResizing && sidebarOpen) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    }
  };

  const handleToggleLayer = (id: string) => {
    setLayers(prev => prev.map(l =>
      l.id === id ? { ...l, visible: !l.visible } : l
    ));
  };

  const handleRemoveLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
  };

  const handleFeatureClick = (layerId: string, featureIndex: number) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer?.features && layer.features[featureIndex]) {
      setSelectedFeatureBounds(layer.features[featureIndex].bounds);
    }
  };

  const handleReorderLayers = (reorderedLayers: Layer[]) => {
    setLayers(reorderedLayers);
  };

  const handleGenerateBoundaries = async (modelId: string, layerId: string) => {
    const selectedRaster = layers.find(l => l.id === layerId && l.type === 'raster');
    
    if (!selectedRaster || !selectedRaster.rasterBounds || !selectedRaster.rasterUrl) {
      alert('Selected image is invalid or missing data.');
      return;
    }

    console.log('=== GENERATE BOUNDARIES DEBUG ===');
    console.log('Selected Raster:', selectedRaster.name);
    console.log('Raster Bounds:', JSON.stringify(selectedRaster.rasterBounds));
    console.log('Bounds format: [[south, west], [north, east]]');
    console.log('South:', selectedRaster.rasterBounds[0][0]);
    console.log('West:', selectedRaster.rasterBounds[0][1]);
    console.log('North:', selectedRaster.rasterBounds[1][0]);
    console.log('East:', selectedRaster.rasterBounds[1][1]);
    console.log('Image Data URL length:', selectedRaster.rasterUrl.length);
    console.log('Model ID:', modelId);
    console.log('Description:', selectedRaster.description);

    // Validate bounds are reasonable geographic coordinates
    const south = selectedRaster.rasterBounds[0][0];
    const west = selectedRaster.rasterBounds[0][1];
    const north = selectedRaster.rasterBounds[1][0];
    const east = selectedRaster.rasterBounds[1][1];

    if (south < -90 || south > 90 || north < -90 || north > 90 || 
        west < -180 || west > 180 || east < -180 || east > 180) {
      alert(`Invalid bounds detected!\nSouth: ${south}\nWest: ${west}\nNorth: ${north}\nEast: ${east}\n\nThese don't look like valid geographic coordinates.`);
      setIsGenerating(false);
      return;
    }

    if (south >= north || west >= east) {
      alert(`Invalid bounds order!\nSouth (${south}) must be < North (${north})\nWest (${west}) must be < East (${east})`);
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);

    try {
      // Call DelineateAnything model with the full raster bounds
      const result = await delineateFields({
        bbox: selectedRaster.rasterBounds,
        modelVersion: modelId,
        modelId,
        imageData: selectedRaster.rasterUrl
      });

      // Extract features from result
      const featureMetadata = result.boundaries.features.map((feature: any, idx: number) => {
        const featureBbox = bbox(feature);
        return {
          id: `delineated-feature-${idx}`,
          name: feature.properties?.name || feature.properties?.id || `Field ${idx + 1}`,
          bounds: [[featureBbox[1], featureBbox[0]], [featureBbox[3], featureBbox[2]]] as [[number, number], [number, number]]
        };
      });

      // Create new layer from delineation result
      const confidence = (result.metadata.confidence ?? 0.9);
      const newLayer: Layer = {
        id: `delineated-${Date.now()}`,
        name: `${selectedRaster.name} - Boundaries`,
        type: 'vector',
        data: result.boundaries,
        visible: true,
        color: '#ef4444', // Red for delineated layers
        description: `Generated ${result.metadata.fieldCount} field boundaries (${result.metadata.processingTime}ms, ${(confidence * 100).toFixed(1)}% confidence)`,
        features: featureMetadata
      };

      setLayers(prev => [newLayer, ...prev]);
      alert(`✅ Successfully generated ${result.metadata.fieldCount} field boundaries!`);

    } catch (error: any) {
      console.error('Error generating boundaries:', error);
      alert(`❌ Error: ${error.message || 'Failed to generate boundaries'}`);
    } finally {
      setIsGenerating(false);
    }
  };


  const handleFileUpload = async (file: File) => {
    // Handle GeoTIFF files
    if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
      try {
        const geotiff = await import('geotiff');
        const proj4 = await import('proj4');
        const arrayBuffer = await file.arrayBuffer();
        const tiff = await geotiff.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const width = image.getWidth();
        const height = image.getHeight();
        const bboxCoords = image.getBoundingBox(); // [minX, minY, maxX, maxY]
        const geoKeys = image.getGeoKeys();
        const samplesPerPixel = image.getSamplesPerPixel();
        
        // Get CRS information
        let finalBounds = bboxCoords;
        let crsDescription = 'Unknown CRS';
        
        // Check if we need to reproject to EPSG:4326
        const epsgCode = geoKeys?.ProjectedCSTypeGeoKey || geoKeys?.GeographicTypeGeoKey;
        
        if (epsgCode && epsgCode !== 4326) {
          // Not WGS84, need to reproject bounds
          console.log(`Reprojecting from EPSG:${epsgCode} to EPSG:4326`);
          crsDescription = `EPSG:${epsgCode}`;
          
          try {
            const fromProj = `EPSG:${epsgCode}`;
            const toProj = 'EPSG:4326';
            
            // Reproject corner points
            const [minX, minY, maxX, maxY] = bboxCoords;
            const [minLon, minLat] = proj4.default(fromProj, toProj, [minX, minY]);
            const [maxLon, maxLat] = proj4.default(fromProj, toProj, [maxX, maxY]);
            
            finalBounds = [minLon, minLat, maxLon, maxLat];
            console.log(`Reprojected bounds: ${finalBounds}`);
          } catch (err) {
            console.error('Reprojection failed:', err);
            alert(`Warning: Could not reproject coordinates from EPSG:${epsgCode} to WGS84. Results may be inaccurate.`);
          }
        } else {
          crsDescription = 'EPSG:4326 (WGS84)';
        }
        
        // Read rasters as separate bands (not interleaved)
        const rasters = await image.readRasters();

        // Create canvas RGB
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        // Rasters is an array of bands [band0, band1, band2, ...]
        const band0 = rasters[0]; // Red or first band
        const band1 = rasters[1]; // Green or second band
        const band2 = rasters[2]; // Blue or third band

        // Detect if values are float (0..1) or uint8 (0..255)
        const isFloat = band0 instanceof Float32Array || band0 instanceof Float64Array;

        for (let i = 0; i < width * height; i++) {
          const r = (band0 as any)[i];
          const g = band1 ? (band1 as any)[i] : r;
          const b = band2 ? (band2 as any)[i] : r;
          
          data[i * 4 + 0] = isFloat ? Math.max(0, Math.min(255, Math.round((r || 0) * 255))) : (r || 0);
          data[i * 4 + 1] = isFloat ? Math.max(0, Math.min(255, Math.round((g || 0) * 255))) : (g || 0);
          data[i * 4 + 2] = isFloat ? Math.max(0, Math.min(255, Math.round((b || 0) * 255))) : (b || 0);
          data[i * 4 + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        const rasterUrl = canvas.toDataURL('image/png');

        const newLayer: Layer = {
          id: `raster-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: 'raster',
          visible: true,
          color: '#10b981',
          description: `Raster layer (${width}x${height}, ${crsDescription})`,
          rasterUrl,
          rasterBounds: [[finalBounds[1], finalBounds[0]], [finalBounds[3], finalBounds[2]]]
        };
        setLayers(prev => [newLayer, ...prev]);
      } catch (err: any) {
        console.error('Error parsing GeoTIFF:', err);
        alert(`Error loading GeoTIFF: ${err.message || err}`);
      }
      return;
    }

    if (file.name.endsWith('.gpkg')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const { GeoPackageAPI, setSqljsWasmLocateFile } = await import('@ngageoint/geopackage');

        // Configure WASM file location
        if (typeof setSqljsWasmLocateFile === 'function') {
          setSqljsWasmLocateFile(file => '/sql-wasm.wasm');
        }

        const gp = await GeoPackageAPI.open(new Uint8Array(arrayBuffer));
        const tables = gp.getFeatureTables();

        const newLayers: Layer[] = [];

        for (const table of tables) {
          const features: any[] = [];
          const iterator = gp.iterateGeoJSONFeatures(table);
          for (const feature of iterator) {
            features.push(feature);
          }

          if (features.length > 0) {
            // Calculate bounds for each feature
            const featureMetadata = features.map((feature, idx) => {
              const featureBbox = bbox(feature);
              return {
                id: `${table}-feature-${idx}`,
                name: feature.properties?.name || feature.properties?.id || `Feature ${idx + 1}`,
                bounds: [[featureBbox[1], featureBbox[0]], [featureBbox[3], featureBbox[2]]] as [[number, number], [number, number]]
              };
            });

            console.log(`Table "${table}" features extracted:`, featureMetadata.length);

            newLayers.push({
              id: `layer-${table}-${Date.now()}`,
              name: table, // Use table name as layer name
              type: 'vector',
              data: { type: 'FeatureCollection', features },
              visible: true,
              color: '#' + Math.floor(Math.random() * 16777215).toString(16), // Random color for each layer
              description: `Imported from ${file.name} - Table: ${table} (${features.length} features)`,
              features: featureMetadata
            });
          }
        }

        if (newLayers.length > 0) {
          setLayers(prev => [...newLayers, ...prev]);
        } else {
          alert('No features found in GeoPackage');
        }
      } catch (err: any) {
        console.error('Error parsing GeoPackage:', err);
        alert(`Error parsing GeoPackage file: ${err.message || err}`);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.type === 'FeatureCollection' || json.type === 'Feature') {
          const data = json.type === 'Feature' ? { type: 'FeatureCollection', features: [json] } : json;

          // Calculate bounds for each feature
          const featureMetadata = data.features.map((feature: any, idx: number) => {
            const featureBbox = bbox(feature);
            return {
              id: `geojson-feature-${idx}`,
              name: feature.properties?.name || feature.properties?.id || `Feature ${idx + 1}`,
              bounds: [[featureBbox[1], featureBbox[0]], [featureBbox[3], featureBbox[2]]] as [[number, number], [number, number]]
            };
          });

          console.log('GeoJSON features extracted:', featureMetadata.length);

          const newLayer: Layer = {
            id: `layer-${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            type: 'vector',
            data,
            visible: true,
            color: '#a855f7', // Purple for user uploads
            description: `User uploaded layer (${data.features.length} features)`,
            features: featureMetadata
          };
          setLayers(prev => [newLayer, ...prev]);
        } else {
          alert('Invalid GeoJSON format');
        }
      } catch (err) {
        console.error(err);
        alert('Error parsing JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <main
      className="flex h-screen w-full bg-slate-950 overflow-hidden"
      onMouseMove={resize}
      onMouseUp={stopResizing}
      onMouseLeave={stopResizing}
    >
      {/* Sidebar toggle button */}
      <button
        className="absolute top-4 left-4 z-[2000] bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-blue-500 transition-colors"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ display: sidebarOpen ? 'none' : 'block' }}
      >
        Open Sidebar
      </button>

      {/* Sidebar */}
      {sidebarOpen && (
        <>
          <Sidebar
            layers={layers}
            onToggleLayer={handleToggleLayer}
            onRemoveLayer={handleRemoveLayer}
            onFileUpload={handleFileUpload}
            onFeatureClick={handleFeatureClick}
            onReorderLayers={handleReorderLayers}
            onGenerateBoundaries={handleGenerateBoundaries}
            isGenerating={isGenerating}
            width={sidebarWidth}
          />
          {/* Resize Handle */}
          <div
            className="w-1 bg-slate-800 hover:bg-blue-500 cursor-col-resize transition-colors z-50 flex items-center justify-center group"
            onMouseDown={startResizing}
          >
            <div className="h-8 w-1 bg-slate-600 rounded-full group-hover:bg-white transition-colors" />
          </div>
        </>
      )}

      <div className="flex-1 relative h-full">
        {/* Map and controls together */}
        <div className="w-full h-full relative">
          {mapVisible && (
            <MapWrapper
              layers={layers}
              selectedFeatureBounds={selectedFeatureBounds}
              drawingMode="none"
              onBoundingBoxCreated={() => {}}
              boundingBoxes={[]}
            />
          )}
          {/* Map controls overlay (top right, with base layers) */}
          <div className="absolute top-4 right-4 z-[2100] flex flex-col gap-2 items-end bg-white/80 p-4 rounded-lg shadow-lg">
            <div className="mb-2 font-bold text-slate-800">Map Options</div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="baseLayer" checked={baseLayer === 'esri'} onChange={() => { setBaseLayer('esri'); setMapVisible(true); }} />
                Satellite (Esri)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="baseLayer" checked={baseLayer === 'google'} onChange={() => { setBaseLayer('google'); setMapVisible(true); }} />
                Satellite (Google)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="baseLayer" checked={baseLayer === 'hybrid'} onChange={() => { setBaseLayer('hybrid'); setMapVisible(true); }} />
                Hybrid (Google)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="baseLayer" checked={baseLayer === 'osm'} onChange={() => { setBaseLayer('osm'); setMapVisible(true); }} />
                Streets (OpenStreetMap)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="baseLayer" checked={baseLayer === 'none'} onChange={() => { setBaseLayer('none'); setMapVisible(false); }} />
                (No Map)
              </label>
            </div>
          </div>
        </div>

        {/* Overlay for no visible layers (optional) */}
        {!layers.some(l => l.visible) && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-700/50 px-6 py-3 rounded-full shadow-2xl pointer-events-none">
            <p className="text-sm text-slate-300 font-medium">
              Toggle a layer to visualize boundaries
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
