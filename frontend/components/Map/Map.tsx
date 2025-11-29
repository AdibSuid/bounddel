'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, LayersControl, useMap, ScaleControl, Rectangle, ImageOverlay } from 'react-leaflet';
import { useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import { Layer, DrawingMode, BoundingBox } from '@/lib/types';

// Component to render raster layers
function RasterLayer({ url, bounds }: { url: string, bounds: [[number, number], [number, number]] }) {
    return <ImageOverlay url={url} bounds={bounds} opacity={1} />;
}

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
    layers: Layer[];
    selectedFeatureBounds: [[number, number], [number, number]] | null;
    drawingMode: DrawingMode;
    onBoundingBoxCreated: (bounds: [[number, number], [number, number]]) => void;
    boundingBoxes: BoundingBox[];
    baseLayer?: string;
}

function MapController({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, 15);
    }, [center, map]);
    return null;
}

function FeatureBoundsController({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
    }, [bounds, map]);
    return null;
}

function LayerVisibilityController({ layers }: { layers: Layer[] }) {
    const map = useMap();
    useEffect(() => {
        // Find the first visible raster layer
        const visibleRaster = layers.find(l => l.visible && l.type === 'raster' && l.rasterBounds);
        if (visibleRaster && visibleRaster.rasterBounds) {
            map.fitBounds(visibleRaster.rasterBounds, { padding: [50, 50], maxZoom: 16 });
        }
    }, [layers, map]);
    return null;
}

// Auto-fit when a vector layer is toggled from hidden -> visible
function VectorVisibilityController({ layers }: { layers: Layer[] }) {
    const map = useMap();
    const prevVisRef = useRef<Record<string, boolean> | null>(null);

    useEffect(() => {
        // Initialize previous visibility on first run, do not navigate
        if (prevVisRef.current === null) {
            const initial: Record<string, boolean> = {};
            layers.forEach(l => { initial[l.id] = !!l.visible; });
            prevVisRef.current = initial;
            return;
        }

        // Find first vector layer toggled on
        for (const l of layers) {
            const prevVisible = prevVisRef.current![l.id];
            const nowVisible = !!l.visible;
            if (l.type === 'vector' && !prevVisible && nowVisible) {
                // Compute bounds from feature metadata if present
                if (l.features && l.features.length > 0) {
                    let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
                    for (const f of l.features) {
                        south = Math.min(south, f.bounds[0][0]);
                        west = Math.min(west, f.bounds[0][1]);
                        north = Math.max(north, f.bounds[1][0]);
                        east = Math.max(east, f.bounds[1][1]);
                    }
                    if (isFinite(south) && isFinite(west) && isFinite(north) && isFinite(east)) {
                        map.fitBounds([[south, west], [north, east]], { padding: [50, 50], maxZoom: 16 });
                        break;
                    }
                }
            }
        }

        // Update previous visibility map
        const nextPrev: Record<string, boolean> = {};
        layers.forEach(l => { nextPrev[l.id] = !!l.visible; });
        prevVisRef.current = nextPrev;
    }, [layers, map]);

    return null;
}

function DrawingController({
    drawingMode,
    onBoundingBoxCreated
}: {
    drawingMode: DrawingMode;
    onBoundingBoxCreated: (bounds: [[number, number], [number, number]]) => void;
}) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        // Remove any existing draw controls
        map.eachLayer((layer) => {
            if (layer instanceof L.Control.Draw) {
                map.removeControl(layer);
            }
        });

        if (drawingMode === 'rectangle') {
            // Enable rectangle drawing
            const drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);

            const drawControl = new L.Control.Draw({
                draw: {
                    rectangle: {
                        shapeOptions: {
                            color: '#a855f7',
                            weight: 2,
                            fillOpacity: 0.1
                        }
                    },
                    polygon: false,
                    polyline: false,
                    circle: false,
                    marker: false,
                    circlemarker: false
                },
                edit: {
                    featureGroup: drawnItems,
                    remove: false
                }
            });

            map.addControl(drawControl);

            // Handle rectangle creation
            const handleCreated = (e: any) => {
                const layer = e.layer;
                const bounds = layer.getBounds();
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();

                onBoundingBoxCreated([
                    [sw.lat, sw.lng],
                    [ne.lat, ne.lng]
                ]);

                // Remove the drawn layer immediately (we'll display it separately)
                map.removeLayer(layer);
            };

            map.on(L.Draw.Event.CREATED, handleCreated);

            return () => {
                map.off(L.Draw.Event.CREATED, handleCreated);
                map.removeControl(drawControl);
                map.removeLayer(drawnItems);
            };
        }
    }, [map, drawingMode, onBoundingBoxCreated]);

    return null;
}

export default function Map({ layers, selectedFeatureBounds, drawingMode, onBoundingBoxCreated, boundingBoxes, baseLayer }: MapProps) {
    // Always define variables at the top
    const safeBaseLayer = baseLayer ?? 'esri';
    const defaultCenter: [number, number] = [37.7749, -122.4194]; // San Francisco
    // Prefer a visible vector layer with geometry to compute a center
    const visibleVectorLayer = layers && layers.length > 0
        ? layers.find(l => l.visible && l.type === 'vector' && l.data && Array.isArray(l.data.features) && l.data.features.length > 0)
        : undefined;

    let center: [number, number] = defaultCenter;
    let hasVectorCenter = false;
    if (
        visibleVectorLayer &&
        visibleVectorLayer.data &&
        Array.isArray(visibleVectorLayer.data.features) &&
        visibleVectorLayer.data.features.length > 0 &&
        visibleVectorLayer.data.features[0]?.geometry?.type === 'Polygon' &&
        Array.isArray(visibleVectorLayer.data.features[0].geometry.coordinates)
    ) {
        center = [
            (visibleVectorLayer.data.features[0].geometry.coordinates[0][0][1] as number),
            (visibleVectorLayer.data.features[0].geometry.coordinates[0][0][0] as number)
        ];
        hasVectorCenter = true;
    }

    // Defensive: If baseLayer is 'none', skip all map logic immediately
    if (safeBaseLayer === 'none') {
        return (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-lg font-bold">
                (No Map)
            </div>
        );
    }
    return (
        <MapContainer center={center} zoom={13} scrollWheelZoom={true} className="w-full h-full">
            <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Satellite (Esri)">
                    <TileLayer
                        attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite (Google)">
                    <TileLayer
                        attribution="&copy; Google Maps"
                        url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Hybrid (Google)">
                    <TileLayer
                        attribution="&copy; Google Maps"
                        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Streets (OpenStreetMap)">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="(No Map - Blank)">
                    <TileLayer
                        attribution="No Map"
                        url=""
                    />
                </LayersControl.BaseLayer>
            </LayersControl>

            {layers && layers.map((layer) => {
                if (!layer.visible) return null;
                
                if (layer.type === 'raster' && layer.rasterUrl && layer.rasterBounds) {
                    return <RasterLayer key={layer.id} url={layer.rasterUrl} bounds={layer.rasterBounds} />;
                }
                
                if (layer.type === 'vector' && layer.data) {
                    return (
                        <GeoJSON
                            key={layer.id}
                            data={layer.data}
                            style={{
                                color: layer.color,
                                weight: 2,
                                opacity: 1,
                                fillColor: layer.color,
                                fillOpacity: 0.2
                            }}
                        />
                    );
                }
                
                return null;
            })}

            {/* Render bounding boxes */}
            {boundingBoxes && boundingBoxes.map((bbox) => (
                <Rectangle
                    key={bbox.id}
                    bounds={bbox.bounds}
                    pathOptions={{
                        color: bbox.status === 'pending' ? '#eab308' :
                            bbox.status === 'processing' ? '#3b82f6' :
                                bbox.status === 'completed' ? '#22c55e' : '#ef4444',
                        weight: 2,
                        fillOpacity: 0.05,
                        dashArray: '5, 5'
                    }}
                />
            ))}

            {/* Do not auto-center on upload; only when user toggles visibility */}
            <FeatureBoundsController bounds={selectedFeatureBounds} />
            <VectorVisibilityController layers={layers} />
            <LayerVisibilityController layers={layers} />
            <DrawingController drawingMode={drawingMode} onBoundingBoxCreated={onBoundingBoxCreated} />
            <ScaleControl position="bottomleft" />
            <MouseCoordinates />
        </MapContainer>
    );
}

function MouseCoordinates() {
    const map = useMap();
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!map) return;

        const handleMouseMove = (e: L.LeafletMouseEvent) => {
            setCoords(e.latlng);
        };

        map.on('mousemove', handleMouseMove);

        return () => {
            map.off('mousemove', handleMouseMove);
        };
    }, [map]);

    if (!coords) return null;

    return (
        <div className="leaflet-bottom leaflet-right">
            <div className="leaflet-control leaflet-bar bg-white/80 backdrop-blur px-2 py-1 text-xs font-mono text-slate-800 border border-slate-300 rounded shadow-sm m-4">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </div>
        </div>
    );
}
