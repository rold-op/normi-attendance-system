interface SparklineProps {
  data: number[];
  active?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  active = true,
  width = 104,
  height = 28,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((val, idx) => {
    const x = padX + (idx / (data.length - 1)) * innerW;
    const y = padY + innerH - ((val - min) / range) * innerH;
    return { x, y };
  });

  // Smooth quadratic path matching the inspiration's clean organic inline trendlines
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = ((prev.x + curr.x) / 2).toFixed(1);
    const midY = ((prev.y + curr.y) / 2).toFixed(1);
    d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d={d}
        stroke={active ? '#1E5628' : '#94A3B8'}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
