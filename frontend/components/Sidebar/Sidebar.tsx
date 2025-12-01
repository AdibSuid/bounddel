'use client';

import { Layer } from '@/lib/types';
import { Layers, Upload, Eye, EyeOff, Trash2, Info, ChevronDown, ChevronRight, MapPin, GripVertical } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface SidebarProps {
    layers: Layer[];
    onToggleLayer: (id: string) => void;
    onRemoveLayer: (id: string) => void;
    onFileUpload: (file: File) => Promise<void>;
    onFeatureClick: (layerId: string, featureIndex: number) => void;
    onReorderLayers: (layers: Layer[]) => void;
    onGenerateBoundaries: (modelId: string, layerId: string) => void;
    isGenerating: boolean;
    width: number;
}

export default function Sidebar({ layers, onToggleLayer, onRemoveLayer, onFileUpload, onFeatureClick, onReorderLayers, onGenerateBoundaries, isGenerating, width }: SidebarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string>('delineate-v1');
    const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

    const rasterLayers = layers.filter(l => l.type === 'raster');
    const canGenerate = rasterLayers.length > 0 && selectedLayer !== null;

    // Auto-select first raster layer
    useEffect(() => {
        if (rasterLayers.length > 0 && !selectedLayer) {
            setSelectedLayer(rasterLayers[0].id);
        }
        if (selectedLayer && !rasterLayers.find(l => l.id === selectedLayer)) {
            setSelectedLayer(rasterLayers.length > 0 ? rasterLayers[0].id : null);
        }
    }, [rasterLayers, selectedLayer]);

    // Persist UI state (collapsed, expanded layers, selected model)
    useEffect(() => {
        try {
            const collapsed = localStorage.getItem('sidebar.collapsed');
            if (collapsed !== null) setIsCollapsed(collapsed === 'true');

            const expanded = localStorage.getItem('sidebar.expandedLayers');
            if (expanded) setExpandedLayers(new Set(JSON.parse(expanded)));
        } catch {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('sidebar.collapsed', String(isCollapsed));
        } catch {}
    }, [isCollapsed]);

    useEffect(() => {
        try {
            localStorage.setItem('sidebar.expandedLayers', JSON.stringify(Array.from(expandedLayers)));
        } catch {}
    }, [expandedLayers]);

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        
        const items = Array.from(layers);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        
        onReorderLayers(items);
    };

    const toggleLayerExpansion = (layerId: string) => {
        setExpandedLayers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(layerId)) {
                newSet.delete(layerId);
            } else {
                newSet.add(layerId);
            }
            return newSet;
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            // Process all selected files
            for (let i = 0; i < files.length; i++) {
                await onFileUpload(files[i]);
            }
            // Reset input so same files can be selected again if needed
            e.target.value = '';
        }
    };

    return (
        <div
            style={{ width: isCollapsed ? '60px' : `${width}px` }}
            className="bg-slate-900 border-r border-slate-800 flex flex-col h-full text-slate-100 shrink-0 transition-all duration-300 relative"
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-6 z-50 bg-slate-800 hover:bg-blue-600 text-white rounded-full p-1 shadow-lg transition-colors"
                title={isCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
                aria-label={isCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isCollapsed ? (
                        <polyline points="9 18 15 12 9 6"></polyline>
                    ) : (
                        <polyline points="15 18 9 12 15 6"></polyline>
                    )}
                </svg>
            </button>

            {/* Hidden file input (always mounted) */}
            <input
                type="file"
                accept=".geojson,.json,.gpkg,.tif,.tiff,image/tiff"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
            />

            {isCollapsed && (
                <div className="flex flex-col items-center gap-3 py-16 px-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-10 h-10 flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                        title="Upload File"
                        aria-label="Upload File"
                    >
                        <Upload size={18} />
                    </button>
                </div>
            )}

            {!isCollapsed && (
                <>
                    <div className="p-6 border-b border-slate-800">
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Layers className="text-blue-500" />
                            BoundaryAI
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">Industrial Delineation System</p>
                    </div>

                    <div className="p-4 border-b border-slate-800">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-lg transition-colors font-medium text-sm"
                            title="Upload GeoJSON, GeoPackage or GeoTIFF"
                            aria-label="Upload File"
                        >
                            <Upload size={16} />
                            Upload File
                        </button>
                    </div>

                    {/* Generate Boundaries Section */}
                    <div className="p-4 border-b border-slate-800 space-y-3">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Generate Boundaries</h3>
                        
                        {/* Select Image */}
                        {rasterLayers.length === 0 ? (
                            <div className="text-center py-4 text-slate-500 text-sm">
                                <p>No .tif files uploaded</p>
                                <p className="text-xs mt-1">Upload a GeoTIFF file above</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-xs text-slate-400 mb-2 block">Select Image</label>
                                    <select
                                        value={selectedLayer || ''}
                                        onChange={(e) => setSelectedLayer(e.target.value)}
                                        className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {rasterLayers.map((layer) => (
                                            <option key={layer.id} value={layer.id}>
                                                {layer.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Select Model */}
                                <div>
                                    <label className="text-xs text-slate-400 mb-2 block">AI Model</label>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="delineate-v1">DelineateAnything v1.0</option>
                                        <option value="delineate-v2">DelineateAnything v2.0</option>
                                        <option value="delineate-hd">DelineateAnything HD</option>
                                    </select>
                                </div>

                                {/* Generate Button */}
                                <button
                                    onClick={() => selectedLayer && onGenerateBoundaries(selectedModel, selectedLayer)}
                                    disabled={!canGenerate || isGenerating}
                                    className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg transition-colors font-medium text-sm ${
                                        !canGenerate || isGenerating
                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
                                    }`}
                                >
                                    <Layers size={16} className={isGenerating ? 'animate-spin' : ''} />
                                    {isGenerating ? 'Generating...' : 'Generate Boundaries'}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Layers</h2>
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="layers">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="space-y-3"
                                    >
                                        {layers.map((layer, index) => {
                                            const isExpanded = expandedLayers.has(layer.id);
                                            const hasFeatures = layer.features && layer.features.length > 0;

                                            return (
                                                <Draggable key={layer.id} draggableId={layer.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`w-full text-left rounded-lg border bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all ${
                                                                snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : ''
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3 p-3">
                                                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                                                        <GripVertical size={16} className="text-slate-500" />
                                                                    </div>
                                                                    {hasFeatures && (
                                                                        <button
                                                                            onClick={() => toggleLayerExpansion(layer.id)}
                                                                            className="p-0.5 text-slate-400 hover:text-white transition-colors shrink-0"
                                                                            title={isExpanded ? 'Collapse features' : 'Expand features'}
                                                                            aria-label={isExpanded ? 'Collapse features' : 'Expand features'}
                                                                        >
                                                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                        </button>
                                                                    )}
                                                                    <div
                                                                        className="w-3 h-3 rounded-full shrink-0"
                                                                        style={{ backgroundColor: layer.color }}
                                                                    />
                                                                    <span className="font-medium text-sm truncate text-slate-200" title={layer.name}>
                                                                        {layer.name}
                                                                    </span>
                                                                    <span
                                                                        className={clsx(
                                                                            'text-[10px] px-1.5 py-0.5 rounded border',
                                                                            layer.type === 'raster'
                                                                                ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                                                                                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                                                        )}
                                                                        title={layer.type === 'raster' ? 'Raster layer' : 'Vector layer'}
                                                                    >
                                                                        {layer.type === 'raster' ? 'Raster' : 'Vector'}
                                                                    </span>
                                                                    {hasFeatures && (
                                                                        <span
                                                                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 border border-slate-600"
                                                                            title={`${layer.features!.length} feature(s)`}
                                                                        >
                                                                            {layer.features!.length}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => onToggleLayer(layer.id)}
                                                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                                                        title={layer.visible ? "Hide Layer" : "Show Layer"}
                                                                        aria-label={layer.visible ? "Hide Layer" : "Show Layer"}
                                                                    >
                                                                        {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => onRemoveLayer(layer.id)}
                                                                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                                                        title="Remove Layer"
                                                                        aria-label="Remove Layer"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {layer.description && (
                                                                <p className="text-xs text-slate-500 px-3 pb-2 line-clamp-2 pl-6">
                                                                    {layer.description}
                                                                </p>
                                                            )}

                                                            {/* Feature List */}
                                                            {isExpanded && hasFeatures && (
                                                                <div className="border-t border-slate-700 mt-2 pt-2 pb-2 px-3 space-y-1">
                                                                    {layer.features!.map((feature, idx) => (
                                                                        <button
                                                                            key={feature.id}
                                                                            onClick={() => onFeatureClick(layer.id, idx)}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 rounded transition-colors text-left"
                                                                        >
                                                                            <MapPin size={12} className="text-slate-500 shrink-0" />
                                                                            <span className="truncate">{feature.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                        {layers.length === 0 && (
                                            <div className="text-center py-8 text-slate-500 text-sm">
                                                No layers added. Upload a file to get started.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex items-start gap-3">
                                <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
                                <div className="text-xs text-slate-400">
                                    <p className="mb-1 text-slate-300 font-medium">System Status</p>
                                    <p>All delineation models are online. Satellite imagery feed is stable.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
