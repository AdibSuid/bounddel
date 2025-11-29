'use client';

import { Square, X, Wand2, ChevronDown, ChevronRight } from 'lucide-react';
import { DrawingMode, BoundingBox, DelineateModel } from '@/lib/types';
import { AVAILABLE_MODELS } from '@/lib/delineateAnything';
import { useState } from 'react';

interface DrawingControlsProps {
    drawingMode: DrawingMode;
    onToggleDrawing: () => void;
    onGenerateBoundaries: (modelId: string) => void;
    boundingBoxes: BoundingBox[];
    onDeleteBoundingBox: (id: string) => void;
    isGenerating: boolean;
}

export default function DrawingControls({
    drawingMode,
    onToggleDrawing,
    onGenerateBoundaries,
    boundingBoxes,
    onDeleteBoundingBox,
    isGenerating
}: DrawingControlsProps) {
    const [open, setOpen] = useState(true);
    const [panelWidth, setPanelWidth] = useState(340);
    const isDrawing = drawingMode === 'rectangle';
    const hasPendingBoxes = boundingBoxes.some(b => b.status === 'pending');
    const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0].id);
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const selectedModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);

    return (
        <div
            className={`absolute top-4 right-4 z-[1000] flex flex-col gap-3 border-4 border-red-500 bg-yellow-100/80 transition-all duration-300`}
            style={{ width: open ? panelWidth : 48 }}
        >
            <button
                onClick={() => setOpen(!open)}
                className="self-end m-2 p-2 rounded-full bg-slate-800 text-white hover:bg-blue-600 transition-colors"
                title={open ? 'Hide Controls' : 'Show Controls'}
            >
                {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
            {open && (
                <>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-800">Drawing Controls</span>
                        <input
                            type="range"
                            min={340}
                            max={600}
                            value={panelWidth}
                            onChange={e => setPanelWidth(Number(e.target.value))}
                            className="w-24"
                            title="Resize Panel"
                        />
                    </div>
                    {/* Drawing Mode Toggle */}
                    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
                        <button
                            onClick={onToggleDrawing}
                            className={`
                flex items-center gap-3 px-4 py-3 w-full transition-all
                ${isDrawing
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }
              `}
                            title={isDrawing ? 'Cancel Drawing' : 'Draw Bounding Box'}
                        >
                            {isDrawing ? (
                                <>
                                    <X size={20} />
                                    <span className="font-medium text-sm">Cancel Drawing</span>
                                </>
                            ) : (
                                <>
                                    <Square size={20} />
                                    <span className="font-medium text-sm">Draw Bounding Box</span>
                                </>
                            )}
                        </button>

                        {isDrawing && (
                            <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700">
                                <p className="text-xs text-slate-400">
                                    Click and drag on the map to draw a rectangle
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Model Selection Dropdown */}
                    {hasPendingBoxes && (
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
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
                    )}

                    {/* Generate Boundaries Button */}
                    {hasPendingBoxes && (
                        <button
                            onClick={() => onGenerateBoundaries(selectedModel)}
                            disabled={isGenerating}
                            className={`
                flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl
                transition-all font-medium text-sm
                ${isGenerating
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
                            }
              `}
                        >
                            <Wand2 size={20} className={isGenerating ? 'animate-pulse' : ''} />
                            <span>
                                {isGenerating ? 'Generating...' : 'Start Delineate'}
                            </span>
                        </button>
                    )}

                    {/* Bounding Box List */}
                    {boundingBoxes.length > 0 && (
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl p-3 max-w-xs">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                Bounding Boxes ({boundingBoxes.length})
                            </h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {boundingBoxes.map((bbox) => (
                                    <div
                                        key={bbox.id}
                                        className="flex items-center justify-between gap-2 bg-slate-800/50 rounded p-2 border border-slate-700/50"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={`
                                w-2 h-2 rounded-full shrink-0
                                ${bbox.status === 'pending' ? 'bg-yellow-500' : ''}
                                ${bbox.status === 'processing' ? 'bg-blue-500 animate-pulse' : ''}
                                ${bbox.status === 'completed' ? 'bg-green-500' : ''}
                                ${bbox.status === 'error' ? 'bg-red-500' : ''}
                              `}
                                                />
                                                <span className="text-xs text-slate-300 truncate">
                                                    {bbox.status === 'pending' && 'Ready'}
                                                    {bbox.status === 'processing' && 'Processing...'}
                                                    {bbox.status === 'completed' && 'Completed'}
                                                    {bbox.status === 'error' && 'Error'}
                                                </span>
                                            </div>
                                            {bbox.error && (
                                                <p className="text-xs text-red-400 mt-1 truncate" title={bbox.error}>
                                                    {bbox.error}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => onDeleteBoundingBox(bbox.id)}
                                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors shrink-0"
                                            title="Delete"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
