'use client';

import { Wand2, ChevronDown, ChevronRight, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { Layer, DelineateModel } from '@/lib/types';
import { AVAILABLE_MODELS } from '@/lib/delineateAnything';
import { useState, useEffect } from 'react';

interface DrawingControlsProps {
    onGenerateBoundaries: (modelId: string, layerId: string) => void;
    isGenerating: boolean;
    rasterLayers: Layer[];
}

export default function DrawingControls({
    onGenerateBoundaries,
    isGenerating,
    rasterLayers
}: DrawingControlsProps) {
    const [open, setOpen] = useState(true);
    const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0].id);
    const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const selectedModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);
    const canGenerate = rasterLayers.length > 0 && selectedLayer !== null;

    // Auto-select first raster layer when available
    useEffect(() => {
        if (rasterLayers.length > 0 && !selectedLayer) {
            setSelectedLayer(rasterLayers[0].id);
        }
        // If selected layer was removed, select another one
        if (selectedLayer && !rasterLayers.find(l => l.id === selectedLayer)) {
            setSelectedLayer(rasterLayers.length > 0 ? rasterLayers[0].id : null);
        }
    }, [rasterLayers, selectedLayer]);

    return (
        <div
            className={`absolute top-4 right-4 z-[1000] flex flex-col gap-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl p-4 transition-all duration-300`}
            style={{ width: open ? 380 : 48 }}
        >
            <button
                onClick={() => setOpen(!open)}
                className="self-end p-2 rounded-full bg-slate-800 text-white hover:bg-blue-600 transition-colors"
                title={open ? 'Hide Controls' : 'Show Controls'}
            >
                {open ? <ChevronRight size={20} /> : <Wand2 size={20} />}
            </button>
            {open && (
                <>
                    <div className="mb-4">
                        <h2 className="font-bold text-white text-lg">Generate Boundaries</h2>
                        <p className="text-xs text-slate-400 mt-1">Select an image and model to delineate field boundaries</p>
                    </div>

                    {/* Uploaded Images List */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden mb-4">
                        <div className="px-4 py-2 border-b border-slate-700">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Select Image (.tif file)
                            </label>
                        </div>
                        {rasterLayers.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                                <ImageIcon size={32} className="mx-auto text-slate-600 mb-2" />
                                <p className="text-sm text-slate-400">No .tif files uploaded</p>
                                <p className="text-xs text-slate-500 mt-1">Upload a GeoTIFF file from the sidebar</p>
                            </div>
                        ) : (
                            <div className="max-h-48 overflow-y-auto">
                                {rasterLayers.map((layer) => (
                                    <button
                                        key={layer.id}
                                        onClick={() => setSelectedLayer(layer.id)}
                                        className={`
                                            w-full px-4 py-3 text-left transition-colors border-b border-slate-700/50 last:border-b-0
                                            ${selectedLayer === layer.id
                                                ? 'bg-blue-600 text-white'
                                                : 'hover:bg-slate-700 text-slate-200'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2">
                                            {selectedLayer === layer.id && <CheckCircle size={16} />}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">
                                                    {layer.name}
                                                </div>
                                                <div className="text-xs opacity-75 mt-0.5">
                                                    {layer.description}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Model Selection Dropdown */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 border-b border-slate-700">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Select Model
                            </label>
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 transition-colors flex items-center justify-between gap-2"
                            >
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-medium text-white">
                                        {selectedModelInfo?.name}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        {selectedModelInfo?.description}
                                    </div>
                                </div>
                                <ChevronDown
                                    size={16}
                                    className={`text-slate-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {isModelDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-10">
                                    {AVAILABLE_MODELS.map((model) => (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                setSelectedModel(model.id);
                                                setIsModelDropdownOpen(false);
                                            }}
                                            className={`
                                                w-full px-4 py-3 text-left transition-colors
                                                ${model.id === selectedModel
                                                    ? 'bg-purple-600 text-white'
                                                    : 'hover:bg-slate-700 text-slate-200'
                                                }
                                            `}
                                        >
                                            <div className="text-sm font-medium">
                                                {model.name}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                {model.description}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Generate Boundaries Button */}
                    <button
                        onClick={() => selectedLayer && onGenerateBoundaries(selectedModel, selectedLayer)}
                        disabled={!canGenerate || isGenerating}
                        className={`
                            w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
                            transition-all font-medium text-sm
                            ${!canGenerate || isGenerating
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg'
                            }
                        `}
                        title={!selectedLayer ? 'Please select an image first' : 'Generate field boundaries for the selected image'}
                    >
                        <Wand2 size={20} className={isGenerating ? 'animate-pulse' : ''} />
                        <span>
                            {isGenerating ? 'Generating Boundaries...' : 'Generate Boundaries'}
                        </span>
                    </button>
                </>
            )}
        </div>
    );
}
