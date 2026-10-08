import { memo, useId, type ReactNode } from 'react';
import { DOODLE_CANVAS_SIZE, type DoodleData, type DoodleStroke, type StickyShape } from '../../domain/guestbook';
import { STICKY_SHAPES } from '../StickyNote/stickyShapes';

interface DoodleProps {
  doodle: DoodleData;
  /** Clip the drawing to a sticky's silhouette (it was drawn on a pad that shape). */
  clipShape?: StickyShape | null | undefined;
  className?: string | undefined;
}

const HIGHLIGHTER_OPACITY = 0.38;
const CRAYON_OPACITY = 0.92;

/**
 * Renders stored doodle strokes as smoothed SVG paths, scaled to fit its box.
 * Used both on the wall and live in the doodle pad, so they always match.
 */
export const Doodle = memo(function Doodle({ doodle, clipShape = null, className }: DoodleProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const crayonFilterId = `doodle-crayon-${uid}`;
  const clipId = `doodle-clip-${uid}`;
  const hasCrayon = doodle.strokes.some((stroke) => stroke.tool === 'crayon');
  const masks: ReactNode[] = [];
  let layer: ReactNode[] = [];

  // Each eraser stroke masks everything drawn before it, so later strokes
  // paint over erased areas just like on paper.
  doodle.strokes.forEach((stroke, i) => {
    if (stroke.tool === 'eraser') {
      const maskId = `doodle-erase-${uid}-${i}`;
      masks.push(
        <mask key={maskId} id={maskId} maskUnits="userSpaceOnUse" x={-10} y={-10} width={120} height={120}>
          <rect x={-10} y={-10} width={120} height={120} fill="#fff" />
          <path d={strokeToPath(stroke.points)} stroke="#000" strokeWidth={stroke.width} />
        </mask>,
      );
      layer = [
        <g key={maskId} mask={`url(#${maskId})`}>
          {layer}
        </g>,
      ];
    } else {
      layer.push(<StrokePath key={i} stroke={stroke} crayonFilterId={crayonFilterId} />);
    }
  });

  return (
    <svg
      className={className}
      viewBox={`0 0 ${DOODLE_CANVAS_SIZE} ${DOODLE_CANVAS_SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {(masks.length > 0 || hasCrayon || clipShape) && (
          <defs>
            {hasCrayon && <CrayonFilter id={crayonFilterId} />}
            {clipShape && (
              <clipPath id={clipId}>
                {STICKY_SHAPES[clipShape].parts.map((part, i) => (
                  <path key={i} d={part.d} transform={part.transform} />
                ))}
              </clipPath>
            )}
            {masks}
          </defs>
        )}
        {clipShape ? <g clipPath={`url(#${clipId})`}>{layer}</g> : layer}
      </g>
    </svg>
  );
});

function StrokePath({ stroke, crayonFilterId }: { stroke: DoodleStroke; crayonFilterId: string }) {
  const d = strokeToPath(stroke.points);
  if (stroke.tool === 'highlighter') {
    return (
      <path
        d={d}
        stroke={stroke.color}
        strokeWidth={stroke.width}
        opacity={HIGHLIGHTER_OPACITY}
        style={{ mixBlendMode: 'multiply' }}
      />
    );
  }
  if (stroke.tool === 'crayon') {
    return (
      <path
        d={d}
        stroke={stroke.color}
        strokeWidth={stroke.width}
        opacity={CRAYON_OPACITY}
        filter={`url(#${crayonFilterId})`}
      />
    );
  }
  return <path d={d} stroke={stroke.color} strokeWidth={stroke.width} />;
}

/**
 * Waxy crayon texture: fine noise knocks speckled gaps out of the stroke
 * and roughens its edges. Works in doodle units, so the grain scales with
 * the drawing and looks the same in the editor and on the wall.
 */
function CrayonFilter({ id }: { id: string }) {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x={-10} y={-10} width={120} height={120} colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="noise" />
      {/* Noise → alpha mask: roughly a third of the stroke drops out as grain. */}
      <feColorMatrix
        in="noise"
        type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -1.05"
        result="grain"
      />
      <feComposite in="SourceGraphic" in2="grain" operator="in" result="speckled" />
      <feDisplacementMap in="speckled" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}

/** Quadratic smoothing through segment midpoints — reads as a pen line. */
function strokeToPath(points: number[]): string {
  const count = points.length / 2;
  if (count === 0) return '';
  const x = (i: number) => points[i * 2]!;
  const y = (i: number) => points[i * 2 + 1]!;
  if (count === 1) return `M${x(0)} ${y(0)}l0.01 0`;

  let d = `M${x(0)} ${y(0)}`;
  for (let i = 1; i < count - 1; i++) {
    const mx = (x(i) + x(i + 1)) / 2;
    const my = (y(i) + y(i + 1)) / 2;
    d += `Q${x(i)} ${y(i)} ${mx} ${my}`;
  }
  return `${d}L${x(count - 1)} ${y(count - 1)}`;
}
