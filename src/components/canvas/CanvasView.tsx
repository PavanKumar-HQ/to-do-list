// CanvasView — Personal Drawing & Visual Explanation Studio (Section 17-23)
// Features: Full-screen canvas, minimal contextual toolbar (Pen, Highlighter, Eraser, Shapes, Arrows, Text),
// Touch/Stylus/Pencil support, Undo/Redo, debounced IndexedDB autosave, relationships linking, PNG export & System Share.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  PenTool,
  Highlighter,
  Eraser,
  Square,
  Circle as CircleIcon,
  ArrowRight,
  Minus,
  Type,
  Undo2,
  Redo2,
  Download,
  Share2,
  Trash2,
  Plus,
  ArrowLeft,
  Save,
  Check,
  Palette,
  Layers,
  Sparkles,
  Link,
  Copy,
  ChevronDown
} from 'lucide-react';
import { db, generateId } from '../../db/db';
import { CanvasRepository } from '../../repositories';
import { formatDisplayDate } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import type { CanvasItem, CanvasObject, EntityType } from '../../types';

type ToolType = 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'text';

const COLORS = [
  '#000000',
  '#2563eb', // Blue
  '#10b981', // Green
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#ffffff'
];

const STROKE_WIDTHS = [2, 4, 8, 14];

export const CanvasView: React.FC = () => {
  const { showToast } = useToast();
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);

  // Queries
  const canvases = useLiveQuery(() => CanvasRepository.queryActive(), []) || [];
  const activeCanvas = canvases.find(c => c.id === activeCanvasId) || null;

  // Studio State
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [undoStack, setUndoStack] = useState<CanvasObject[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasObject[][]>([]);

  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#2563eb');
  const [currentWidth, setCurrentWidth] = useState<number>(4);
  const [canvasName, setCanvasName] = useState<string>('Untitled Canvas');
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [currentPointer, setCurrentPointer] = useState<{ x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const saveTimeoutRef = useRef<any>(null);

  // Load canvas objects on switch
  useEffect(() => {
    if (activeCanvas) {
      setObjects(activeCanvas.objects || []);
      setCanvasName(activeCanvas.name);
      setUndoStack([]);
      setRedoStack([]);
      setIsSaved(true);
    }
  }, [activeCanvasId]);

  // Debounced Autosave (Section 21)
  const persistCanvas = useCallback(
    (newObjects: CanvasObject[], name?: string) => {
      if (!activeCanvasId) return;
      setIsSaved(false);

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await CanvasRepository.update(activeCanvasId, {
            objects: newObjects,
            name: name !== undefined ? name : canvasName
          });
          setIsSaved(true);
        } catch (err) {
          console.error('Failed to autosave canvas:', err);
        }
      }, 400);
    },
    [activeCanvasId, canvasName]
  );

  const pushState = (newObjects: CanvasObject[]) => {
    setUndoStack(prev => [...prev, objects]);
    setRedoStack([]);
    setObjects(newObjects);
    persistCanvas(newObjects);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, prev.length - 1));
    setRedoStack(prev => [...prev, objects]);
    setObjects(previous);
    persistCanvas(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, prev.length - 1));
    setUndoStack(prev => [...prev, objects]);
    setObjects(next);
    persistCanvas(next);
  };

  const handleClear = () => {
    if (objects.length === 0) return;
    if (window.confirm('Clear all drawings from this canvas?')) {
      pushState([]);
      showToast('Canvas cleared', { type: 'info' });
    }
  };

  // Pointer position helper
  const getCoordinates = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top)
    };
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const pt = getCoordinates(e);
    setIsDrawing(true);

    if (currentTool === 'pen' || currentTool === 'highlighter') {
      setCurrentPoints([pt]);
    } else if (currentTool === 'eraser') {
      eraseAtPoint(pt);
    } else if (currentTool === 'text') {
      const textVal = prompt('Enter text for canvas:');
      if (textVal && textVal.trim()) {
        const textObj: CanvasObject = {
          id: generateId(),
          type: 'text',
          x: pt.x,
          y: pt.y,
          text: textVal.trim(),
          color: currentColor,
          strokeWidth: 1,
          fontSize: currentWidth * 5 + 12,
          createdAt: new Date().toISOString()
        };
        pushState([...objects, textObj]);
      }
      setIsDrawing(false);
    } else {
      // Shape / Arrow / Line
      setShapeStart(pt);
      setCurrentPointer(pt);
    }
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    const pt = getCoordinates(e);

    if (currentTool === 'pen' || currentTool === 'highlighter') {
      setCurrentPoints(prev => [...prev, pt]);
    } else if (currentTool === 'eraser') {
      eraseAtPoint(pt);
    } else {
      setCurrentPointer(pt);
    }
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const endPt = getCoordinates(e);

    if ((currentTool === 'pen' || currentTool === 'highlighter') && currentPoints.length > 0) {
      const newStroke: CanvasObject = {
        id: generateId(),
        type: 'stroke',
        x: 0,
        y: 0,
        points: currentPoints,
        color: currentColor,
        strokeWidth: currentTool === 'highlighter' ? currentWidth * 3 : currentWidth,
        fill: currentTool === 'highlighter' ? 'rgba(250, 204, 21, 0.35)' : undefined,
        createdAt: new Date().toISOString()
      };
      pushState([...objects, newStroke]);
      setCurrentPoints([]);
    } else if (shapeStart && currentPointer) {
      const dx = endPt.x - shapeStart.x;
      const dy = endPt.y - shapeStart.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        let newShape: CanvasObject | null = null;
        if (currentTool === 'rectangle') {
          newShape = {
            id: generateId(),
            type: 'shape',
            shapeType: 'rectangle',
            x: Math.min(shapeStart.x, endPt.x),
            y: Math.min(shapeStart.y, endPt.y),
            width: Math.abs(dx),
            height: Math.abs(dy),
            color: currentColor,
            strokeWidth: currentWidth,
            createdAt: new Date().toISOString()
          };
        } else if (currentTool === 'circle') {
          const radius = Math.round(Math.hypot(dx, dy));
          newShape = {
            id: generateId(),
            type: 'shape',
            shapeType: 'circle',
            x: shapeStart.x,
            y: shapeStart.y,
            width: radius * 2,
            height: radius * 2,
            color: currentColor,
            strokeWidth: currentWidth,
            createdAt: new Date().toISOString()
          };
        } else if (currentTool === 'line') {
          newShape = {
            id: generateId(),
            type: 'line',
            x: shapeStart.x,
            y: shapeStart.y,
            points: [shapeStart, endPt],
            color: currentColor,
            strokeWidth: currentWidth,
            createdAt: new Date().toISOString()
          };
        } else if (currentTool === 'arrow') {
          newShape = {
            id: generateId(),
            type: 'arrow',
            x: shapeStart.x,
            y: shapeStart.y,
            points: [shapeStart, endPt],
            color: currentColor,
            strokeWidth: currentWidth,
            createdAt: new Date().toISOString()
          };
        }

        if (newShape) {
          pushState([...objects, newShape]);
        }
      }
      setShapeStart(null);
      setCurrentPointer(null);
    }
  };

  // Erase items near point
  const eraseAtPoint = (pt: { x: number; y: number }) => {
    const threshold = currentWidth * 4 + 10;
    const remaining = objects.filter(obj => {
      if (obj.type === 'stroke' && obj.points) {
        return !obj.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold);
      }
      if (obj.type === 'shape' || obj.type === 'text') {
        const dist = Math.hypot(obj.x - pt.x, obj.y - pt.y);
        return dist > threshold;
      }
      if (obj.points) {
        return !obj.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold);
      }
      return true;
    });

    if (remaining.length !== objects.length) {
      setObjects(remaining);
      persistCanvas(remaining);
    }
  };

  // Export to PNG (Section 23)
  const handleExportPng = async () => {
    if (!svgRef.current) return;

    try {
      const svg = svgRef.current;
      const width = svg.clientWidth || 1200;
      const height = svg.clientHeight || 800;

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const URLObj = window.URL || window.webkitURL || window;
      const blobURL = URLObj.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
          if (!blob) return;
          const a = document.createElement('a');
          a.download = `${canvasName.replace(/\s+/g, '_')}.png`;
          a.href = URL.createObjectURL(blob);
          a.click();
          showToast('Canvas exported as PNG', { type: 'success' });
        }, 'image/png');
      };
      image.src = blobURL;
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, { type: 'error' });
    }
  };

  // System Share Sheet (Section 23)
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: canvasName,
          text: `Personal Life OS Canvas drawing: ${canvasName}`
        });
      } catch (err) {
        console.warn('Share dismissed or cancelled');
      }
    } else {
      handleExportPng();
    }
  };

  const handleCreateCanvas = async () => {
    const title = prompt('Enter canvas title:', 'New Visual Note');
    if (!title?.trim()) return;

    const newCanvas = await CanvasRepository.create({ name: title.trim() });
    setActiveCanvasId(newCanvas.id);
    showToast(`Created canvas: ${newCanvas.name}`, { type: 'success' });
  };

  const handleDeleteCanvas = async (id: string, name: string) => {
    if (!window.confirm(`Move "${name}" to trash?`)) return;
    await CanvasRepository.softDelete(id);
    if (activeCanvasId === id) setActiveCanvasId(null);
    showToast('Canvas moved to trash');
  };

  // ------------------ Canvas Dashboard (List View) ------------------
  if (!activeCanvasId) {
    return (
      <div className="page-wrapper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Canvas
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Personal drawing and visual explanation space
            </p>
          </div>
          <button onClick={handleCreateCanvas} className="btn btn-primary btn-sm" style={{ gap: '4px' }}>
            <Plus size={16} />
            <span>New Canvas</span>
          </button>
        </div>

        {canvases.length === 0 ? (
          <div className="card" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <PenTool size={40} color="var(--accent)" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Draw, Sketch & Explain
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', margin: '6px auto 18px auto' }}>
              Create mind-maps, website architecture sketches, arrows, and visual diagrams stored securely offline.
            </p>
            <button onClick={handleCreateCanvas} className="btn btn-primary" style={{ margin: '0 auto' }}>
              Create Your First Canvas
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {canvases.map(c => (
              <div
                key={c.id}
                className="card"
                onClick={() => setActiveCanvasId(c.id)}
                style={{
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '160px',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {c.name}
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteCanvas(c.id, c.name);
                      }}
                      className="btn-ghost"
                      style={{ color: 'var(--text-muted)', padding: '2px' }}
                      title="Delete canvas"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {c.objects ? `${c.objects.length} visual objects` : 'Empty canvas'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span>Updated {formatDisplayDate(c.updatedAt.slice(0, 10))}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Open →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ------------------ Full-Screen Visual Studio ------------------
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      {/* Studio Header Toolbar */}
      <div
        style={{
          height: '52px',
          background: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          gap: '8px',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActiveCanvasId(null)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px', gap: '4px' }}
            title="Back to Canvases"
          >
            <ArrowLeft size={16} />
            <span style={{ fontSize: '12px' }}>Back</span>
          </button>

          <input
            type="text"
            value={canvasName}
            onChange={e => {
              setCanvasName(e.target.value);
              persistCanvas(objects, e.target.value);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--text-primary)',
              maxWidth: '180px',
              padding: '2px 6px'
            }}
          />

          <span style={{ fontSize: '11px', color: isSaved ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            {isSaved ? <Check size={12} /> : null}
            <span>{isSaved ? 'Saved' : 'Saving...'}</span>
          </span>
        </div>

        {/* Undo / Redo / Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="btn-ghost"
            style={{ padding: '6px', opacity: undoStack.length === 0 ? 0.35 : 1 }}
            title="Undo"
          >
            <Undo2 size={17} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="btn-ghost"
            style={{ padding: '6px', opacity: redoStack.length === 0 ? 0.35 : 1 }}
            title="Redo"
          >
            <Redo2 size={17} />
          </button>
          <button
            onClick={handleClear}
            className="btn-ghost"
            style={{ padding: '6px', color: 'var(--danger)' }}
            title="Clear canvas"
          >
            <Trash2 size={17} />
          </button>
          <button
            onClick={handleExportPng}
            className="btn btn-secondary btn-sm"
            style={{ gap: '4px', fontSize: '12px' }}
            title="Export PNG"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
          <button
            onClick={handleShare}
            className="btn-ghost"
            style={{ padding: '6px' }}
            title="Share"
          >
            <Share2 size={17} />
          </button>
        </div>
      </div>

      {/* Floating Contextual Drawing Palette (Minimal, Non-obtrusive) */}
      <div
        style={{
          position: 'absolute',
          top: '62px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '24px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          zIndex: 20
        }}
      >
        {/* Tools */}
        <button
          onClick={() => setCurrentTool('pen')}
          style={{
            background: currentTool === 'pen' ? 'var(--accent)' : 'transparent',
            color: currentTool === 'pen' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
          title="Pen tool"
        >
          <PenTool size={16} />
        </button>

        <button
          onClick={() => setCurrentTool('highlighter')}
          style={{
            background: currentTool === 'highlighter' ? 'var(--accent)' : 'transparent',
            color: currentTool === 'highlighter' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
          title="Highlighter"
        >
          <Highlighter size={16} />
        </button>

        <button
          onClick={() => setCurrentTool('eraser')}
          style={{
            background: currentTool === 'eraser' ? 'var(--accent)' : 'transparent',
            color: currentTool === 'eraser' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
          title="Eraser"
        >
          <Eraser size={16} />
        </button>

        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

        {/* Shapes & Connectors */}
        <button
          onClick={() => setCurrentTool('arrow')}
          style={{
            background: currentTool === 'arrow' ? 'var(--accent)' : 'transparent',
            color: currentTool === 'arrow' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
          title="Arrow connector"
        >
          <ArrowRight size={16} />
        </button>

        <button
          onClick={() => setCurrentTool('line')}
          style={{
            background: currentTool === 'line' ? 'var(--accent)' : 'transparent',
            color: currentTool === 'line' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
          title="Straight line"
        >
          <Minus size={16} />
        </button>

        <button
          onClick={() => setCurrentTool('rectangle')}
          style={{
            background: currentTool === 'rectangle' ? 'var(--accent)' : 'transparent',
            color: currentTool === 'rectangle' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
          title="Rectangle"
        >
          <Square size={16} />
        </button>

        <button
          onClick={() => setCurrentTool('circle')}
          style={{
            background: currentTool === 'circle' ? 'var(--accent)' : 'transparent',
            color: currentTool === 'circle' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
          title="Circle"
        >
          <CircleIcon size={16} />
        </button>

        <button
          onClick={() => setCurrentTool('text')}
          style={{
            background: currentTool === 'text' ? 'var(--accent)' : 'transparent',
            color: currentTool === 'text' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
          title="Text"
        >
          <Type size={16} />
        </button>

        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

        {/* Color Palette Dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {COLORS.slice(0, 5).map(col => (
            <div
              key={col}
              onClick={() => setCurrentColor(col)}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: col,
                border: currentColor === col ? '2px solid var(--accent)' : '1px solid rgba(0,0,0,0.2)',
                cursor: 'pointer',
                transform: currentColor === col ? 'scale(1.2)' : 'none',
                transition: 'transform 0.1s ease'
              }}
            />
          ))}
        </div>
      </div>

      {/* Interactive SVG Drawing Canvas Area */}
      <svg
        ref={svgRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          background: '#ffffff',
          cursor: currentTool === 'eraser' ? 'crosshair' : 'default'
        }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={currentColor} />
          </marker>
        </defs>

        {/* Persisted Objects */}
        {objects.map(obj => {
          if (obj.type === 'stroke' && obj.points && obj.points.length > 1) {
            const pathData = `M ${obj.points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
            return (
              <path
                key={obj.id}
                d={pathData}
                stroke={obj.color}
                strokeWidth={obj.strokeWidth}
                fill={obj.fill || 'none'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }
          if (obj.type === 'shape' && obj.shapeType === 'rectangle') {
            return (
              <rect
                key={obj.id}
                x={obj.x}
                y={obj.y}
                width={obj.width}
                height={obj.height}
                stroke={obj.color}
                strokeWidth={obj.strokeWidth}
                fill="none"
                rx={4}
              />
            );
          }
          if (obj.type === 'shape' && obj.shapeType === 'circle') {
            return (
              <circle
                key={obj.id}
                cx={obj.x}
                cy={obj.y}
                r={(obj.width || 40) / 2}
                stroke={obj.color}
                strokeWidth={obj.strokeWidth}
                fill="none"
              />
            );
          }
          if (obj.type === 'line' && obj.points && obj.points.length === 2) {
            return (
              <line
                key={obj.id}
                x1={obj.points[0].x}
                y1={obj.points[0].y}
                x2={obj.points[1].x}
                y2={obj.points[1].y}
                stroke={obj.color}
                strokeWidth={obj.strokeWidth}
                strokeLinecap="round"
              />
            );
          }
          if (obj.type === 'arrow' && obj.points && obj.points.length === 2) {
            return (
              <line
                key={obj.id}
                x1={obj.points[0].x}
                y1={obj.points[0].y}
                x2={obj.points[1].x}
                y2={obj.points[1].y}
                stroke={obj.color}
                strokeWidth={obj.strokeWidth}
                markerEnd="url(#arrowhead)"
              />
            );
          }
          if (obj.type === 'text' && obj.text) {
            return (
              <text
                key={obj.id}
                x={obj.x}
                y={obj.y}
                fill={obj.color}
                fontSize={obj.fontSize || 16}
                fontWeight={600}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {obj.text}
              </text>
            );
          }
          return null;
        })}

        {/* Active In-Progress Stroke */}
        {isDrawing && (currentTool === 'pen' || currentTool === 'highlighter') && currentPoints.length > 1 && (
          <path
            d={`M ${currentPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`}
            stroke={currentColor}
            strokeWidth={currentTool === 'highlighter' ? currentWidth * 3 : currentWidth}
            fill={currentTool === 'highlighter' ? 'rgba(250, 204, 21, 0.35)' : 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Active In-Progress Shape / Arrow / Line */}
        {isDrawing && shapeStart && currentPointer && (
          <>
            {currentTool === 'rectangle' && (
              <rect
                x={Math.min(shapeStart.x, currentPointer.x)}
                y={Math.min(shapeStart.y, currentPointer.y)}
                width={Math.abs(currentPointer.x - shapeStart.x)}
                height={Math.abs(currentPointer.y - shapeStart.y)}
                stroke={currentColor}
                strokeWidth={currentWidth}
                fill="none"
                strokeDasharray="4 4"
                rx={4}
              />
            )}
            {currentTool === 'circle' && (
              <circle
                cx={shapeStart.x}
                cy={shapeStart.y}
                r={Math.hypot(currentPointer.x - shapeStart.x, currentPointer.y - shapeStart.y)}
                stroke={currentColor}
                strokeWidth={currentWidth}
                fill="none"
                strokeDasharray="4 4"
              />
            )}
            {currentTool === 'line' && (
              <line
                x1={shapeStart.x}
                y1={shapeStart.y}
                x2={currentPointer.x}
                y2={currentPointer.y}
                stroke={currentColor}
                strokeWidth={currentWidth}
                strokeDasharray="4 4"
              />
            )}
            {currentTool === 'arrow' && (
              <line
                x1={shapeStart.x}
                y1={shapeStart.y}
                x2={currentPointer.x}
                y2={currentPointer.y}
                stroke={currentColor}
                strokeWidth={currentWidth}
                markerEnd="url(#arrowhead)"
              />
            )}
          </>
        )}
      </svg>
    </div>
  );
};
