import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../config/api';
import './ScanViewer.css';

interface Scan {
  id: string;
  url: string;
  name: string;
  type: string;
  date?: string;
  recordId?: string; // Track which record this scan belongs to
}

interface Annotation {
  id: string;
  type: 'arrow' | 'text' | 'circle' | 'rectangle' | 'line' | 'freehand';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  points?: { x: number; y: number }[];
}

// Annotations are now persisted to the backend and automatically saved/loaded

interface ScanViewerProps {
  scans: Scan[];
  onClose: () => void;
  initialScanIndex?: number;
  onDeleteScan?: (scanId: string) => void;
  canDelete?: boolean;
  recordId?: string; // Medical record ID for saving annotations
}

const ScanViewer: React.FC<ScanViewerProps> = ({ scans, onClose, initialScanIndex = 0, onDeleteScan, canDelete = false, recordId }) => {
  const { token } = useAuth();
  const [currentScanIndex, setCurrentScanIndex] = useState(initialScanIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedScans, setSelectedScans] = useState<number[]>([0, 1]);
  const [toolMode, setToolMode] = useState<Annotation['type'] | 'select' | null>('select'); // Default to select mode
  const [annotations, setAnnotations] = useState<{ [scanId: string]: Annotation[] }>({});
  const [drawing, setDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Partial<Annotation> | null>(null);
  const [annotationColor, setAnnotationColor] = useState('#ff0000');
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [isMovingAnnotation, setIsMovingAnnotation] = useState(false);
  const [moveStart, setMoveStart] = useState<{ x: number; y: number } | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentScan = scans[currentScanIndex];
  const currentAnnotations = annotations[currentScan?.id || ''] || [];

  // State for image blob URLs (for authenticated images)
  const [imageBlobs, setImageBlobs] = useState<{ [url: string]: string }>({});

  // Load image with authentication and create blob URL
  useEffect(() => {
    const loadImage = async (url: string) => {
      if (imageBlobs[url]) return;
      
      // Check if it's an API URL that needs authentication
      const isApiUrl = url.includes('/api/medical-records/assets/') || url.includes('medical-records/assets/');
      
      if (isApiUrl && token) {
        try {
          // Ensure we have the full API URL
          let fullUrl = url;
          if (url.startsWith('/api/')) {
            fullUrl = apiUrl(url.replace('/api/', ''));
          } else if (!url.startsWith('http')) {
            fullUrl = apiUrl(url);
          }
          
          console.log('Loading image from:', fullUrl);
          
          const response = await fetch(fullUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            setImageBlobs(prev => ({ ...prev, [url]: blobUrl }));
            console.log('Image loaded successfully as blob URL');
          } else {
            console.error('Failed to load image:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('Error loading image:', error);
        }
      }
    };

    if (currentScan && currentScan.url) {
      loadImage(currentScan.url);
    }

    // Cleanup blob URLs on unmount
    return () => {
      Object.values(imageBlobs).forEach(blobUrl => URL.revokeObjectURL(blobUrl));
    };
  }, [currentScan?.url, token]);

  // Get image URL with authentication
  const getImageUrl = (url: string): string => {
    // If we have a blob URL for this image, use it
    if (imageBlobs[url]) {
      return imageBlobs[url];
    }
    
    // If URL is still loading, return the API URL with token
    // Otherwise, return the original URL or API URL
    if (url.includes('/api/medical-records/assets/') || url.includes('medical-records/assets/')) {
      if (url.startsWith('/api/')) {
        return apiUrl(url.replace('/api/', ''));
      } else if (!url.startsWith('http')) {
        return apiUrl(url);
      }
    }
    return url;
  };

  // Load annotations from backend
  useEffect(() => {
    const loadAnnotations = async () => {
      const initial: { [key: string]: Annotation[] } = {};
      
      for (const scan of scans) {
        // Use scan's recordId if available, otherwise fall back to prop recordId
        const scanRecordId = scan.recordId || recordId;
        
        if (!scanRecordId || !token) {
          initial[scan.id] = [];
          continue;
        }

        try {
          const attachmentId = scan.id;
          console.log('Loading annotations for:', { scanRecordId, attachmentId, scanName: scan.name });
          
          const response = await fetch(apiUrl(`medical-records/${scanRecordId}/attachments/${attachmentId}/annotations`), {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            initial[scan.id] = data.annotations || [];
            console.log('✅ Loaded annotations:', { attachmentId, count: initial[scan.id].length });
          } else {
            // If no annotations exist yet, start with empty array
            initial[scan.id] = [];
            console.log('No annotations found for:', attachmentId);
          }
        } catch (error) {
          console.error('Error loading annotations:', error);
          initial[scan.id] = [];
        }
      }

      setAnnotations(initial);
    };

    loadAnnotations();
  }, [scans, recordId, token]);

  // Save annotations to backend when they change (debounced)
  const saveAnnotationsToBackend = useCallback(async () => {
    // Use scan's recordId if available, otherwise fall back to prop recordId
    const scanRecordId = currentScan?.recordId || recordId;
    
    if (!scanRecordId || !token || !currentScan) {
      console.log('⚠️ Cannot save: missing recordId, token, or currentScan', { 
        scanRecordId,
        recordId,
        scanHasRecordId: !!currentScan?.recordId,
        hasToken: !!token, 
        hasCurrentScan: !!currentScan 
      });
      return;
    }

    try {
      const attachmentId = currentScan.id;
      const annotationsToSave = annotations[currentScan.id] || [];

      console.log('💾 Saving annotations:', { 
        recordId: scanRecordId, 
        attachmentId, 
        count: annotationsToSave.length,
        scanName: currentScan.name
      });

      const response = await fetch(apiUrl(`medical-records/${scanRecordId}/attachments/${attachmentId}/annotations`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ annotations: annotationsToSave }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Annotations saved successfully:', data);
      } else {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || 'Unknown error' };
        }
        console.error('❌ Failed to save annotations:', response.status, error);
      }
    } catch (error) {
      console.error('❌ Error saving annotations:', error);
    }
  }, [annotations, currentScan, recordId, token]);

  // Debounced save effect
  useEffect(() => {
    const scanRecordId = currentScan?.recordId || recordId;
    if (!scanRecordId || !token || !currentScan) return;

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Set new timeout to save after 1 second of inactivity
    const timeout = setTimeout(() => {
      saveAnnotationsToBackend();
    }, 1000);

    setSaveTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [annotations, currentScan?.id, recordId, token, saveAnnotationsToBackend]);

  // Reset view when scan changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setImageLoaded(false);
  }, [currentScanIndex]);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(5, zoom * delta));
      setZoom(newZoom);
    }
  }, [zoom]);

  // Get image coordinates from mouse event
  const getImageCoordinates = (e: React.MouseEvent): { x: number; y: number } | null => {
    if (!imageRef.current) return null;
    
    const img = imageRef.current;
    const imgRect = img.getBoundingClientRect();
    
    // Calculate coordinates in image space (accounting for zoom and pan)
    const x = (e.clientX - imgRect.left - pan.x) / zoom;
    const y = (e.clientY - imgRect.top - pan.y) / zoom;
    
    return { x, y };
  };

  // Get bounding box for annotation (for selection box)
  const getAnnotationBounds = (ann: Annotation): { minX: number; minY: number; maxX: number; maxY: number } => {
    if (ann.type === 'circle') {
      const radius = Math.sqrt((ann.width || 0) ** 2 + (ann.height || 0) ** 2);
      return {
        minX: ann.x - radius,
        minY: ann.y - radius,
        maxX: ann.x + radius,
        maxY: ann.y + radius
      };
    } else if (ann.type === 'rectangle') {
      const minX = Math.min(ann.x, ann.x + (ann.width || 0));
      const maxX = Math.max(ann.x, ann.x + (ann.width || 0));
      const minY = Math.min(ann.y, ann.y + (ann.height || 0));
      const maxY = Math.max(ann.y, ann.y + (ann.height || 0));
      return { minX, minY, maxX, maxY };
    } else if (ann.type === 'arrow' || ann.type === 'line') {
      const x1 = ann.x;
      const y1 = ann.y;
      const x2 = ann.x + (ann.width || 0);
      const y2 = ann.y + (ann.height || 0);
      return {
        minX: Math.min(x1, x2),
        minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2),
        maxY: Math.max(y1, y2)
      };
    } else if (ann.type === 'freehand' && ann.points && ann.points.length > 0) {
      const xs = ann.points.map(p => p.x);
      const ys = ann.points.map(p => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys)
      };
    } else if (ann.type === 'text') {
      return {
        minX: ann.x,
        minY: ann.y - 20,
        maxX: ann.x + 100,
        maxY: ann.y + 5
      };
    }
    return { minX: ann.x, minY: ann.y, maxX: ann.x, maxY: ann.y };
  };

  // Check if point is inside annotation
  const isPointInAnnotation = (x: number, y: number, ann: Annotation): boolean => {
    if (ann.type === 'circle') {
      const radius = Math.sqrt((ann.width || 0) ** 2 + (ann.height || 0) ** 2);
      const dist = Math.sqrt((x - ann.x) ** 2 + (y - ann.y) ** 2);
      return dist <= radius + 5; // 5px tolerance
    } else if (ann.type === 'rectangle') {
      const minX = Math.min(ann.x, ann.x + (ann.width || 0));
      const maxX = Math.max(ann.x, ann.x + (ann.width || 0));
      const minY = Math.min(ann.y, ann.y + (ann.height || 0));
      const maxY = Math.max(ann.y, ann.y + (ann.height || 0));
      return x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5;
    } else if (ann.type === 'arrow' || ann.type === 'line') {
      const x1 = ann.x;
      const y1 = ann.y;
      const x2 = ann.x + (ann.width || 0);
      const y2 = ann.y + (ann.height || 0);
      const dist = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return dist <= 5 && x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5;
    } else if (ann.type === 'freehand' && ann.points) {
      // Check if point is near any point in the freehand path
      return ann.points.some(p => Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2) <= 10);
    } else if (ann.type === 'text') {
      // Approximate text bounding box
      return x >= ann.x - 5 && x <= ann.x + 100 && y >= ann.y - 20 && y <= ann.y + 5;
    }
    return false;
  };

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key to delete selected annotation
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotation && !drawing) {
        e.preventDefault();
        handleDeleteAnnotation(selectedAnnotation);
        setSelectedAnnotation(null);
      }
      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedAnnotation(null);
        setToolMode('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotation, drawing]);

  // Handle mouse down - Professional FigJam-like interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const coords = getImageCoordinates(e);
    if (!coords || !currentScan) return;

    // Find annotation at click point
    const clickedAnnotation = currentAnnotations.find(ann => 
      isPointInAnnotation(coords.x, coords.y, ann)
    );
    
    // If a drawing tool is active, create new annotation
    if (toolMode && toolMode !== 'select' && 
        (toolMode === 'arrow' || toolMode === 'text' || toolMode === 'circle' || 
         toolMode === 'rectangle' || toolMode === 'line' || toolMode === 'freehand')) {
      const mode: Annotation['type'] = toolMode;
      
      if (mode === 'text') {
        setTextPosition(coords);
        setTextInput('');
      } else {
        setDrawing(true);
        setCurrentAnnotation({
          type: mode,
          x: coords.x,
          y: coords.y,
          color: annotationColor,
          points: mode === 'freehand' ? [{ x: coords.x, y: coords.y }] : undefined
        });
      }
      return;
    }

    // Default behavior: Select mode (like FigJam)
    if (clickedAnnotation) {
      // Clicked on annotation - select it and prepare to move
      setSelectedAnnotation(clickedAnnotation.id);
      setIsMovingAnnotation(true);
      setDragStartPos({ x: clickedAnnotation.x, y: clickedAnnotation.y });
      setMoveStart(coords);
    } else {
      // Clicked on empty space - deselect
      setSelectedAnnotation(null);
      setIsMovingAnnotation(false);
    }

    // Pan with modifier keys
    if (e.button === 0 && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  // Handle mouse move - Professional interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const coords = getImageCoordinates(e);
    if (!coords || !currentScan) return;
    
    // Always show hover effect in select mode
    if (toolMode === 'select' || !toolMode) {
      const hovered = currentAnnotations.find(ann => 
        isPointInAnnotation(coords.x, coords.y, ann)
      );
      setHoveredAnnotation(hovered?.id || null);
    }
    
    // Move selected annotation by dragging
    if (isMovingAnnotation && selectedAnnotation && moveStart && dragStartPos) {
      const deltaX = coords.x - moveStart.x;
      const deltaY = coords.y - moveStart.y;
      
      if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
        setAnnotations(prev => {
          const updated = { ...prev };
          const scanAnnotations = [...(updated[currentScan.id] || [])];
          const index = scanAnnotations.findIndex(a => a.id === selectedAnnotation);
          
          if (index !== -1) {
            const ann = { ...scanAnnotations[index] };
            // Calculate new position from original drag start
            const totalDeltaX = coords.x - moveStart.x;
            const totalDeltaY = coords.y - moveStart.y;
            
            ann.x = dragStartPos.x + totalDeltaX;
            ann.y = dragStartPos.y + totalDeltaY;
            
            // Update points for freehand annotations
            if (ann.points && dragStartPos) {
              ann.points = ann.points.map(p => ({ 
                x: p.x + totalDeltaX, 
                y: p.y + totalDeltaY 
              }));
            }
            
            scanAnnotations[index] = ann;
            updated[currentScan.id] = scanAnnotations;
          }
          
          return updated;
        });
      }
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (drawing && currentAnnotation) {
      if (currentAnnotation.type === 'freehand') {
        setCurrentAnnotation({
          ...currentAnnotation,
          points: [...(currentAnnotation.points || []), { x: coords.x, y: coords.y }]
        });
      } else {
        setCurrentAnnotation({
          ...currentAnnotation,
          width: coords.x - currentAnnotation.x!,
          height: coords.y - currentAnnotation.y!
        });
      }
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    } else if (isMovingAnnotation) {
      // Finished moving - reset to select mode if we were in a drawing tool
      setIsMovingAnnotation(false);
      setMoveStart(null);
      setDragStartPos(null);
      // Auto-switch back to select mode after moving
      if (toolMode && toolMode !== 'select') {
        // Keep the tool active for continued drawing
      }
    } else if (drawing && currentAnnotation && currentScan) {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: currentAnnotation.type!,
        x: currentAnnotation.x!,
        y: currentAnnotation.y!,
        width: currentAnnotation.width,
        height: currentAnnotation.height,
        color: currentAnnotation.color!,
        points: currentAnnotation.points
      };
      
      setAnnotations(prev => ({
        ...prev,
        [currentScan.id]: [...(prev[currentScan.id] || []), newAnnotation]
      }));
      
      setDrawing(false);
      setCurrentAnnotation(null);
      // Auto-switch back to select mode after creating annotation
      setToolMode('select');
    }
  };

  // Draw annotations on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const imgRect = img.getBoundingClientRect();
      if (imgRect.width > 0 && imgRect.height > 0) {
        canvas.width = imgRect.width;
        canvas.height = imgRect.height;
        canvas.style.width = `${imgRect.width}px`;
        canvas.style.height = `${imgRect.height}px`;
      }
    };

    const draw = () => {
      if (!canvas || !img) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw existing annotations with professional styling
      currentAnnotations.forEach(ann => {
        const isHovered = hoveredAnnotation === ann.id && toolMode === 'select';
        const isSelected = selectedAnnotation === ann.id;
        
        // Professional highlight colors
        let strokeColor = ann.color;
        let fillColor = ann.color;
        let lineWidth = Math.max(2, 2 / zoom);
        
        if (isSelected) {
          strokeColor = '#0066ff';
          fillColor = '#0066ff';
          lineWidth = Math.max(3, 3 / zoom);
          // Draw selection box
          ctx.strokeStyle = '#0066ff';
          ctx.lineWidth = 1 / zoom;
          ctx.setLineDash([5 / zoom, 5 / zoom]);
          const padding = 5 / zoom;
          if (ann.type === 'circle') {
            const radius = Math.sqrt((ann.width || 0) ** 2 + (ann.height || 0) ** 2);
            ctx.strokeRect(ann.x - radius - padding, ann.y - radius - padding, 
                          (radius + padding) * 2, (radius + padding) * 2);
          } else if (ann.type === 'rectangle') {
            const minX = Math.min(ann.x, ann.x + (ann.width || 0));
            const maxX = Math.max(ann.x, ann.x + (ann.width || 0));
            const minY = Math.min(ann.y, ann.y + (ann.height || 0));
            const maxY = Math.max(ann.y, ann.y + (ann.height || 0));
            ctx.strokeRect(minX - padding, minY - padding, 
                          (maxX - minX) + padding * 2, (maxY - minY) + padding * 2);
          } else {
            // For other types, draw a simple box around the annotation
            const bounds = getAnnotationBounds(ann);
            ctx.strokeRect(bounds.minX - padding, bounds.minY - padding,
                          bounds.maxX - bounds.minX + padding * 2,
                          bounds.maxY - bounds.minY + padding * 2);
          }
          ctx.setLineDash([]);
        } else if (isHovered) {
          strokeColor = '#3399ff';
          fillColor = '#3399ff';
          lineWidth = Math.max(2.5, 2.5 / zoom);
        }
        
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = fillColor;
        ctx.lineWidth = lineWidth;

        if (ann.type === 'arrow') {
          drawArrow(ctx, ann.x, ann.y, (ann.x + (ann.width || 50)), (ann.y + (ann.height || 50)));
        } else if (ann.type === 'circle') {
          const radius = Math.sqrt((ann.width || 0) ** 2 + (ann.height || 0) ** 2);
          ctx.beginPath();
          ctx.arc(ann.x, ann.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (ann.type === 'rectangle') {
          ctx.strokeRect(ann.x, ann.y, ann.width || 0, ann.height || 0);
        } else if (ann.type === 'line') {
          ctx.beginPath();
          ctx.moveTo(ann.x, ann.y);
          ctx.lineTo(ann.x + (ann.width || 0), ann.y + (ann.height || 0));
          ctx.stroke();
        } else if (ann.type === 'freehand' && ann.points && ann.points.length > 0) {
          ctx.beginPath();
          ann.points.forEach((point, i) => {
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        } else if (ann.type === 'text' && ann.text) {
          ctx.font = `${Math.max(12, 16 / zoom)}px Arial`;
          ctx.fillText(ann.text, ann.x, ann.y);
        }
      });

      // Draw current annotation being created
      if (currentAnnotation && drawing) {
        ctx.strokeStyle = currentAnnotation.color || annotationColor;
        ctx.fillStyle = currentAnnotation.color || annotationColor;
        ctx.lineWidth = Math.max(2, 2 / zoom);

        if (currentAnnotation.type === 'arrow') {
          drawArrow(ctx, currentAnnotation.x!, currentAnnotation.y!, 
            currentAnnotation.x! + (currentAnnotation.width || 0), 
            currentAnnotation.y! + (currentAnnotation.height || 0));
        } else if (currentAnnotation.type === 'circle') {
          const radius = Math.sqrt((currentAnnotation.width || 0) ** 2 + (currentAnnotation.height || 0) ** 2);
          ctx.beginPath();
          ctx.arc(currentAnnotation.x!, currentAnnotation.y!, radius, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (currentAnnotation.type === 'rectangle') {
          ctx.strokeRect(currentAnnotation.x!, currentAnnotation.y!, 
            currentAnnotation.width || 0, currentAnnotation.height || 0);
        } else if (currentAnnotation.type === 'line') {
          ctx.beginPath();
          ctx.moveTo(currentAnnotation.x!, currentAnnotation.y!);
          ctx.lineTo(currentAnnotation.x! + (currentAnnotation.width || 0), 
            currentAnnotation.y! + (currentAnnotation.height || 0));
          ctx.stroke();
        } else if (currentAnnotation.type === 'freehand' && currentAnnotation.points && currentAnnotation.points.length > 0) {
          ctx.beginPath();
          currentAnnotation.points.forEach((point, i) => {
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    updateCanvasSize();
    draw();
    
    // Redraw on zoom/pan changes
    const timeoutId = setTimeout(() => {
      updateCanvasSize();
      draw();
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [currentAnnotations, currentAnnotation, drawing, zoom, pan, annotationColor, currentScan, imageLoaded, hoveredAnnotation, toolMode, selectedAnnotation]);

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
    const headlen = 10;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const handleZoomIn = () => setZoom(prev => Math.min(5, prev * 1.2));
  const handleZoomOut = () => setZoom(prev => Math.max(0.5, prev / 1.2));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleAddText = () => {
    if (textInput && textPosition && currentScan) {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: 'text',
        x: textPosition.x,
        y: textPosition.y,
        text: textInput,
        color: annotationColor
      };
      
      setAnnotations(prev => ({
        ...prev,
        [currentScan.id]: [...(prev[currentScan.id] || []), newAnnotation]
      }));
      
      setTextInput('');
      setTextPosition(null);
      setToolMode('select');
    }
  };

  const handleDeleteAnnotation = (annotationId: string) => {
    if (currentScan) {
      console.log('Deleting annotation:', annotationId);
      setAnnotations(prev => {
        const updated = {
          ...prev,
          [currentScan.id]: (prev[currentScan.id] || []).filter(a => a.id !== annotationId)
        };
        console.log('Updated annotations:', updated[currentScan.id]?.length || 0);
        return updated;
      });
      setSelectedAnnotation(null);
    }
  };

  const handleClearAnnotations = () => {
    if (currentScan) {
      setAnnotations(prev => ({
        ...prev,
        [currentScan.id]: []
      }));
    }
  };

  if (scans.length === 0) {
    return (
      <div className="scan-viewer-modal">
        <div className="scan-viewer-content">
          <div className="scan-viewer-header">
            <h2>No Scans Available</h2>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
        </div>
      </div>
    );
  }

  const imageUrl = getImageUrl(currentScan.url);

  return (
    <div className="scan-viewer-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="scan-viewer-content">
        <div className="scan-viewer-header">
          <h2>Medical Scan Viewer</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="scan-viewer-toolbar">
          <div className="toolbar-group">
            <button onClick={handleZoomIn} title="Zoom In">🔍+</button>
            <button onClick={handleZoomOut} title="Zoom Out">🔍-</button>
            <button onClick={handleReset} title="Reset View">⌂</button>
            <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="toolbar-group">
            <button 
              onClick={() => setComparisonMode(!comparisonMode)}
              className={comparisonMode ? 'active' : ''}
              title="Toggle Comparison Mode"
            >
              {comparisonMode ? '📊' : '📋'} Compare
            </button>
          </div>

          <div className="toolbar-group">
            <span>Tools:</span>
            <button 
              onClick={() => {
                setToolMode(toolMode === 'select' ? null : 'select');
                setSelectedAnnotation(null);
              }}
              className={toolMode === 'select' || !toolMode ? 'active' : ''}
              title="Select Tool (V) - Click to select, drag to move, Delete key to remove"
              style={(toolMode === 'select' || !toolMode) ? { background: '#007bff', borderColor: '#0056b3', fontWeight: 'bold' } : {}}
            >
              👆 Select
            </button>
            <button 
              onClick={() => {
                setToolMode(toolMode === 'arrow' ? 'select' : 'arrow');
                setSelectedAnnotation(null);
              }}
              className={toolMode === 'arrow' ? 'active' : ''}
              title="Arrow Tool"
            >
              ➡️ Arrow
            </button>
            <button 
              onClick={() => {
                setToolMode(toolMode === 'circle' ? 'select' : 'circle');
                setSelectedAnnotation(null);
              }}
              className={toolMode === 'circle' ? 'active' : ''}
              title="Circle Tool"
            >
              ⭕ Circle
            </button>
            <button 
              onClick={() => {
                setToolMode(toolMode === 'rectangle' ? 'select' : 'rectangle');
                setSelectedAnnotation(null);
              }}
              className={toolMode === 'rectangle' ? 'active' : ''}
              title="Rectangle Tool"
            >
              ▭ Rectangle
            </button>
            <button 
              onClick={() => {
                setToolMode(toolMode === 'line' ? 'select' : 'line');
                setSelectedAnnotation(null);
              }}
              className={toolMode === 'line' ? 'active' : ''}
              title="Line Tool"
            >
              ─ Line
            </button>
            <button 
              onClick={() => {
                setToolMode(toolMode === 'freehand' ? 'select' : 'freehand');
                setSelectedAnnotation(null);
              }}
              className={toolMode === 'freehand' ? 'active' : ''}
              title="Freehand Tool"
            >
              ✏️ Freehand
            </button>
            <button 
              onClick={() => {
                setToolMode(toolMode === 'text' ? 'select' : 'text');
                setSelectedAnnotation(null);
              }}
              className={toolMode === 'text' ? 'active' : ''}
              title="Text Tool"
            >
              T Text
            </button>
            {selectedAnnotation && (
              <button 
                onClick={() => {
                  handleDeleteAnnotation(selectedAnnotation);
                  setSelectedAnnotation(null);
                }}
                title="Delete Selected (or press Delete key)"
                style={{ background: '#dc3545', borderColor: '#c82333', fontWeight: 'bold' }}
              >
                🗑️ Delete
              </button>
            )}
            <input 
              type="color" 
              value={annotationColor} 
              onChange={(e) => setAnnotationColor(e.target.value)}
              title="Annotation Color"
              disabled={toolMode === 'select' || !toolMode}
            />
            <button 
              onClick={handleClearAnnotations} 
              title="Clear All Annotations"
              style={{ background: '#6c757d', borderColor: '#5a6268' }}
            >
              🗑️ Clear All
            </button>
          </div>

          {!comparisonMode && scans.length > 1 && (
            <div className="toolbar-group">
              <button 
                onClick={() => setCurrentScanIndex(prev => (prev - 1 + scans.length) % scans.length)}
                disabled={scans.length === 1}
              >
                ← Prev
              </button>
              <span>{currentScanIndex + 1} / {scans.length}</span>
              <button 
                onClick={() => setCurrentScanIndex(prev => (prev + 1) % scans.length)}
                disabled={scans.length === 1}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {textPosition && (
          <div 
            className="text-input-overlay"
            style={{ 
              left: `${textPosition.x * zoom + pan.x}px`, 
              top: `${textPosition.y * zoom + pan.y}px` 
            }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddText();
                } else if (e.key === 'Escape') {
                  setTextPosition(null);
                  setTextInput('');
                  setToolMode('select');
                }
              }}
              autoFocus
              placeholder="Enter text..."
            />
            <button onClick={handleAddText}>Add</button>
            <button onClick={() => {
              setTextPosition(null);
              setTextInput('');
              setToolMode('select');
            }}>Cancel</button>
          </div>
        )}

        <div 
          className="scan-viewer-body"
          ref={containerRef}
          onWheel={handleWheel}
        >
          {comparisonMode ? (
            <div className="comparison-view">
              {selectedScans.slice(0, 2).map((scanIdx, idx) => {
                const scan = scans[scanIdx];
                return (
                  <div key={scan.id} className="comparison-pane">
                    <h3>{scan.name}</h3>
                    <div className="image-container">
                      <img 
                        ref={idx === 0 ? imageRef : null}
                        src={getImageUrl(scan.url)} 
                        alt={scan.name}
                        style={{
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          transformOrigin: 'top left'
                        }}
                      />
                      {idx === 0 && <canvas ref={canvasRef} className="annotation-canvas" />}
                    </div>
                  </div>
                );
              })}
              {scans.length > 2 && (
                <div className="scan-selector">
                  <label>Select scans to compare:</label>
                  {scans.map((scan, idx) => (
                    <label key={scan.id}>
                      <input
                        type="checkbox"
                        checked={selectedScans.includes(idx)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedScans([...selectedScans, idx].slice(0, 2));
                          } else {
                            setSelectedScans(selectedScans.filter(i => i !== idx));
                          }
                        }}
                      />
                      {scan.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="single-view">
              <div className="scan-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3>{currentScan.name}</h3>
                    {currentScan.date && <p>Date: {new Date(currentScan.date).toLocaleDateString()}</p>}
                    <p>Type: {currentScan.type}</p>
                  </div>
                  {canDelete && onDeleteScan && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete "${currentScan.name}"?`)) {
                          onDeleteScan(currentScan.id);
                        }
                      }}
                      style={{
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                      title="Delete Scan"
                    >
                      🗑️ Delete Scan
                    </button>
                  )}
                </div>
              </div>
              <div className="image-container">
                <img 
                  ref={imageRef}
                  src={imageUrl}
                  alt={currentScan.name}
                  crossOrigin="anonymous"
                  onLoad={() => {
                    console.log('Image loaded successfully:', imageUrl);
                    setImageLoaded(true);
                    const canvas = canvasRef.current;
                    const img = imageRef.current;
                    if (canvas && img) {
                      // Wait a bit for the image to fully render
                      setTimeout(() => {
                        const imgRect = img.getBoundingClientRect();
                        if (imgRect.width > 0 && imgRect.height > 0) {
                          canvas.width = imgRect.width;
                          canvas.height = imgRect.height;
                          canvas.style.width = `${imgRect.width}px`;
                          canvas.style.height = `${imgRect.height}px`;
                        }
                      }, 100);
                    }
                  }}
                  onError={(e) => {
                    console.error('Image load error - URL:', imageUrl);
                    console.error('Image load error - Blob URL exists:', !!imageBlobs[currentScan.url]);
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
                  }}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'top left',
                    display: 'block',
                    maxWidth: '100%',
                    height: 'auto'
                  }}
                />
                <canvas 
                  ref={canvasRef} 
                  className="annotation-canvas"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    handleMouseUp();
                    setHoveredAnnotation(null);
                  }}
                  style={{
                    pointerEvents: 'auto',
                    cursor: isMovingAnnotation ? 'grabbing' :
                            selectedAnnotation && toolMode === 'select' ? 'grab' :
                            hoveredAnnotation && toolMode === 'select' ? 'pointer' :
                            toolMode && toolMode !== 'select' ? 'crosshair' : 
                            'default'
                  }}
                />
              </div>
              {currentAnnotations.length > 0 && (
                <div className="annotations-list">
                  <h4>Annotations ({currentAnnotations.length})</h4>
                  <p style={{ color: '#999', fontSize: '12px', margin: '8px 0' }}>
                    💡 <strong>Select Tool (default):</strong> Click to select, drag to move | 
                    <strong> Delete key</strong> to remove selected | 
                    <strong> Drawing tools:</strong> Click tool, then draw on image
                  </p>
                  <p style={{ color: '#28a745', fontSize: '11px', margin: '8px 0', fontStyle: 'italic' }}>
                    ✓ Annotations auto-save and persist when you close the viewer.
                  </p>
                  {selectedAnnotation && (
                    <p style={{ color: '#007bff', fontSize: '11px', margin: '8px 0', fontWeight: 'bold' }}>
                      ✓ Annotation selected - Press <strong>Delete</strong> key or click Delete button to remove
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="scan-viewer-instructions">
          <p><strong>Controls:</strong> Ctrl/Cmd + Scroll to zoom | Ctrl/Cmd + Drag to pan | Click annotation tools to annotate</p>
        </div>
      </div>
    </div>
  );
};

export default ScanViewer;
