'use client';

import dynamic from 'next/dynamic';
import { Layer, DrawingMode, BoundingBox } from '@/lib/types';

const Map = dynamic(() => import('./Map'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
            <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Initializing Satellite Feed...</p>
            </div>
        </div>
    )
});

export default function MapWrapper({
    layers,
    selectedFeatureBounds,
    drawingMode,
    onBoundingBoxCreated,
    boundingBoxes
}: {
    layers: Layer[];
    selectedFeatureBounds: [[number, number], [number, number]] | null;
    drawingMode: DrawingMode;
    onBoundingBoxCreated: (bounds: [[number, number], [number, number]]) => void;
    boundingBoxes: BoundingBox[];
}) {
    return (
        <Map
            layers={layers}
            selectedFeatureBounds={selectedFeatureBounds}
            drawingMode={drawingMode}
            onBoundingBoxCreated={onBoundingBoxCreated}
            boundingBoxes={boundingBoxes}
        />
    );
}
