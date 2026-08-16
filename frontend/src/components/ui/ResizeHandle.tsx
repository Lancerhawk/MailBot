"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction?: "horizontal" | "vertical";
  className?: string;
}

export function ResizeHandle({ onResize, direction = "horizontal", className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPos.current = direction === "horizontal" ? e.clientX : e.clientY;
  }, [direction]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      startPos.current = currentPos;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, direction, onResize]);

  const isHorizontal = direction === "horizontal";

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`
        group relative flex items-center justify-center
        ${isHorizontal ? "w-1 cursor-col-resize hover:w-1.5" : "h-1 cursor-row-resize hover:h-1.5"}
        transition-all duration-150
        ${className || ""}
      `}
    >
      <div
        className={`
          absolute rounded-full transition-all duration-200
          ${isHorizontal ? "h-8 w-1" : "w-8 h-1"}
          ${isDragging
            ? "bg-orange-500 scale-110"
            : "bg-zinc-300 dark:bg-zinc-700 group-hover:bg-orange-400 dark:group-hover:bg-orange-500"
          }
        `}
      />
      {/* Wider invisible hit target for easier grabbing */}
      <div
        className={`absolute ${isHorizontal ? "inset-y-0 -left-1 -right-1" : "inset-x-0 -top-1 -bottom-1"}`}
      />
    </div>
  );
}
