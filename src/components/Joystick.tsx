import React, { useRef, useState, useEffect } from "react";

export const Joystick = ({
  onMove,
}: {
  onMove: (x: number, y: number) => void;
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [padCenter, setPadCenter] = useState({ x: 0, y: 0 });
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const rect = padRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setPadCenter({ x: centerX, y: centerY });
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateStick(e.clientX, e.clientY, centerX, centerY, rect.width / 2);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!isDragging) return;
    const rect = padRef.current?.getBoundingClientRect();
    if (rect) {
      updateStick(
        e.clientX,
        e.clientY,
        padCenter.x,
        padCenter.y,
        rect.width / 2,
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    setStickPos({ x: 0, y: 0 });
    onMove(0, 0); // Reset movement
    if (e.target && (e.target as HTMLElement).releasePointerCapture) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const updateStick = (
    clientX: number,
    clientY: number,
    centerX: number,
    centerY: number,
    radius: number,
  ) => {
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
    const angle = Math.atan2(dy, dx);

    const stickX = distance * Math.cos(angle);
    const stickY = distance * Math.sin(angle);

    setStickPos({ x: stickX, y: stickY });

    // Normalize values between -1 and 1
    onMove(stickX / radius, stickY / radius);
  };

  return (
    <div
      ref={padRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="w-32 h-32 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-full flex items-center justify-center touch-none select-none relative"
    >
      <div
        className="w-12 h-12 bg-white/50 backdrop-blur border border-white/40 rounded-full absolute shadow-lg"
        style={{ transform: `translate(${stickPos.x}px, ${stickPos.y}px)` }}
      />
    </div>
  );
};
