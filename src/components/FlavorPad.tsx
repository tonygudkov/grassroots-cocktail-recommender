"use client";

import type { Point } from "@/types";

type FlavorPadProps = {
  title: string;
  xLeft: string;
  xRight: string;
  yTop: string;
  yBottom: string;
  point: Point;
  onChange: (point: Point) => void;
};

const clamp = (value: number, min = -100, max = 100) => Math.min(max, Math.max(min, value));

export function FlavorPad({ title, xLeft, xRight, yTop, yBottom, point, onChange }: FlavorPadProps) {
  const updateFromPointer = (clientX: number, clientY: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    const x = clamp(((clientX - rect.left) / rect.width) * 200 - 100);
    const y = clamp(100 - ((clientY - rect.top) / rect.height) * 200);
    onChange({ x: Math.round(x), y: Math.round(y) });
  };

  const left = `${((point.x + 100) / 200) * 100}%`;
  const top = `${((100 - point.y) / 200) * 100}%`;

  return (
    <div className="flavor-pad-wrap">
      <div className="pad-title-row">
        <h3>{title}</h3>
        <span>
          {point.x}, {point.y}
        </span>
      </div>
      <div
        className="flavor-pad"
        role="application"
        tabIndex={0}
        aria-label={`${title} flavor map`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event.clientX, event.clientY, event.currentTarget);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) {
            updateFromPointer(event.clientX, event.clientY, event.currentTarget);
          }
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 5;
          if (event.key === "ArrowLeft") onChange({ ...point, x: clamp(point.x - step) });
          if (event.key === "ArrowRight") onChange({ ...point, x: clamp(point.x + step) });
          if (event.key === "ArrowUp") onChange({ ...point, y: clamp(point.y + step) });
          if (event.key === "ArrowDown") onChange({ ...point, y: clamp(point.y - step) });
        }}
      >
        <span className="axis-label axis-left">{xLeft}</span>
        <span className="axis-label axis-right">{xRight}</span>
        <span className="axis-label axis-top">{yTop}</span>
        <span className="axis-label axis-bottom">{yBottom}</span>
        <span className="axis-line horizontal" />
        <span className="axis-line vertical" />
        <span className="flavor-point" style={{ left, top }} />
      </div>
    </div>
  );
}
