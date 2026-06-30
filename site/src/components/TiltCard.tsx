"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

export function TiltCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glow, setGlow] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setRotate({
      x: (y - 0.5) * -8,
      y: (x - 0.5) * 8,
    });
    setGlow({ x: x * 100, y: y * 100 });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setGlow({ x: 50, y: 50 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX: rotate.x, rotateY: rotate.y }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      className={`relative ${className || ""}`}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(10, 36, 115, 0.06) 0%, transparent 60%)`,
          opacity: rotate.x !== 0 || rotate.y !== 0 ? 1 : 0,
        }}
      />
      {children}
    </motion.div>
  );
}
