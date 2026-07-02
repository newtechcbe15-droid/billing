import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, PenTool } from "lucide-react";

interface SignatureCanvasProps {
  onSaveSignature: (base64DataUrl: string) => void;
  onClearSignature?: () => void;
  defaultValue?: string; // Existing signature string fallback if updating record
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  onSaveSignature,
  onClearSignature,
  defaultValue
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Initialize and scale canvas bounding box to match device pixel ratios
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Scale canvas dimensions tracking backing store ratios to prevent pixel blur
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a"; // Modern dark slate ink signature line stroke

    // If a default value profile exists, render it onto the fresh grid coordinates
    if (defaultValue) {
      const img = new Image();
      img.src = defaultValue;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setIsEmpty(false);
      };
    }
  }, [defaultValue]);

  useEffect(() => {
    setupCanvas();
    
    // Listen to window changes to recalculate container scaling factors
    window.addEventListener("resize", setupCanvas);
    return () => window.removeEventListener("resize", setupCanvas);
  }, [setupCanvas]);

  // Unified position coordinate tracking across desktop mouse and mobile touch points
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    exportData();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    if (onClearSignature) onClearSignature();
    // Export empty parameter string signaling removal matrices
    onSaveSignature("");
  };

  const exportData = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;

    // Compress raw canvas pixels to performant image/png base64 streams
    const base64Data = canvas.toDataURL("image/png");
    onSaveSignature(base64Data);
  };

  return (
    <div ref={containerRef} className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-blue-500" />
          Customer Handshake Signature Canvas
        </label>
        {!isEmpty && (
          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 px-1.5 py-0.5 rounded animate-fadeIn">
            Vector Stream Capture Active
          </span>
        )}
      </div>

      {/* CORE HTML5 CANVAS BOX WRAPPER */}
      <div className="relative border border-dashed border-slate-300 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900/40 h-44 group transition-all duration-200 focus-within:ring-1 focus-within:ring-ring">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair touch-none absolute inset-0 z-10"
        />
        
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-30 select-none z-0">
            <p className="text-xs font-medium">Draw authorization confirmation signature here</p>
            <p className="text-[10px] font-mono mt-1">Accepts touch vectors and mouse gestures</p>
          </div>
        )}
      </div>

      {/* ACTION DECK BAR */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isEmpty}
          onClick={clearCanvas}
          className="text-xs h-8 px-3 border-slate-200 dark:border-zinc-800 font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 shadow-none"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1.5 stroke-[2.2]" />
          Reset Matrix Canvas
        </Button>
      </div>
    </div>
  );
};