import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { CSSProperties } from 'react';
import {
  DOODLE_CANVAS_SIZE,
  type DoodleData,
  type DoodleStroke,
  type DoodleTool,
  type StickyShape,
} from '../../domain/guestbook';
import { Doodle } from '../Doodle/Doodle';
import { PolaroidFrame } from '../PolaroidFrame/PolaroidFrame';
import { STICKY_SHAPES } from '../StickyNote/stickyShapes';
import styles from './DoodlePad.module.css';

interface DoodlePadProps {
  value: DoodleData;
  onChange: (doodle: DoodleData) => void;
  /** The sticky shape being drawn on (the pad takes its silhouette); null for a Polaroid's square print. */
  shape: StickyShape | null;
  label: string;
}

/** Warm, rich inks; laid out as a 3 × 3 grid. */
export const INKS = [
  { name: 'Ink', value: '#2a2522' },
  { name: 'Indigo', value: '#2e4793' },
  { name: 'Teal', value: '#24777a' },
  { name: 'Moss', value: '#47693a' },
  { name: 'Mustard', value: '#e0a91c' },
  { name: 'Tangerine', value: '#d36a1e' },
  { name: 'Brick', value: '#b33a26' },
  { name: 'Rose', value: '#c4506c' },
  { name: 'Plum', value: '#6e3f86' },
] as const;

const TOOL_WIDTHS: Record<DoodleTool, number> = { pen: 2.4, highlighter: 9, crayon: 5, eraser: 9 };
/** Ignore pointer jitter smaller than this (doodle units) to keep stroke data small. */
const MIN_POINT_DISTANCE = 0.4;

const TOOL_ICONS: Record<DoodleTool, { label: string; icon: ReactNode }> = {
  pen: { label: 'Pen', icon: <path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3" /> },
  highlighter: { label: 'Highlighter', icon: <path d="M8 14 15 3l5 3-7 11zM8 14l-3 6h6l2-3M11 9l5 3" /> },
  crayon: {
    label: 'Crayon',
    icon: <path d="M4 20l1.6-5.2 9.9-9.9a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8l-9.9 9.9zM5.6 14.8l3.6 3.6M12.6 7.8l3.6 3.6" />,
  },
  eraser: { label: 'Eraser', icon: <path d="M9 20h11M4 15l9-9 6 6-8 8H8zM9 10l6 6" /> },
};

/** Drawing tools in the first row; eraser, undo and clear in the second. */
const DRAWING_TOOLS: DoodleTool[] = ['pen', 'highlighter', 'crayon'];

/** A square drawing surface producing resolution-independent doodle strokes. */
export function DoodlePad({ value, onChange, shape, label }: DoodlePadProps) {
  const [tool, setTool] = useState<DoodleTool>('pen');
  const [ink, setInk] = useState<string>(INKS[0].value);
  // The stroke being drawn lives in a ref so fast pointer events never miss it;
  // state mirrors it for rendering.
  const strokeRef = useRef<DoodleStroke | null>(null);
  const [current, setCurrent] = useState<DoodleStroke | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const isEmpty = value.strokes.length === 0 && !current;

  const toPoint = (event: PointerEvent | globalThis.PointerEvent): [number, number] => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const clampUnit = (n: number) => Math.min(DOODLE_CANVAS_SIZE, Math.max(0, Math.round(n * 10) / 10));
    return [
      clampUnit(((event.clientX - rect.left) / rect.width) * DOODLE_CANVAS_SIZE),
      clampUnit(((event.clientY - rect.top) / rect.height) * DOODLE_CANVAS_SIZE),
    ];
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    strokeRef.current = { tool, color: ink, width: TOOL_WIDTHS[tool], points: toPoint(event) };
    setCurrent(strokeRef.current);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    // Coalesced events give smoother lines on fast pens and high-refresh screens.
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    const points = [...stroke.points];
    for (const e of events) {
      const [x, y] = toPoint(e);
      const lastX = points[points.length - 2]!;
      const lastY = points[points.length - 1]!;
      if (Math.hypot(x - lastX, y - lastY) >= MIN_POINT_DISTANCE) points.push(x, y);
    }
    strokeRef.current = { ...stroke, points };
    setCurrent(strokeRef.current);
  };

  const finishStroke = () => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    strokeRef.current = null;
    onChange({ ...value, strokes: [...value.strokes, stroke] });
    setCurrent(null);
  };

  const displayed: DoodleData = current ? { ...value, strokes: [...value.strokes, current] } : value;

  const surface = (
    <div
      ref={surfaceRef}
      className={styles.surface}
      data-tool={tool}
      data-shape={shape ?? 'print'}
      role="img"
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
    >
      {shape && (
        <svg className={styles.silhouette} viewBox="0 0 100 100" aria-hidden="true">
          {STICKY_SHAPES[shape].parts.map((part, i) => (
            <path key={i} d={part.d} transform={part.transform} />
          ))}
        </svg>
      )}
      <Doodle className={styles.drawing} doodle={displayed} clipShape={shape} />
      {isEmpty && (
        <span className={styles.hint} style={hintInset(shape)}>
          draw something silly or profound or both
        </span>
      )}
    </div>
  );

  const toolButton = (option: DoodleTool) => (
    <button
      key={option}
      type="button"
      className={styles.tool}
      aria-pressed={tool === option}
      aria-label={TOOL_ICONS[option].label}
      title={TOOL_ICONS[option].label}
      onClick={() => setTool(option)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {TOOL_ICONS[option].icon}
      </svg>
    </button>
  );

  return (
    <div className={styles.pad}>
      <div className={styles.controls}>
        <div className={styles.swatches} role="group" aria-label="Colour">
          {INKS.map(({ name, value: color }) => (
            <button
              key={color}
              type="button"
              className={styles.swatch}
              style={{ background: color, '--swatch': color } as CSSProperties}
              aria-pressed={ink === color}
              aria-label={name}
              title={name}
              disabled={tool === 'eraser'}
              onClick={() => setInk(color)}
            />
          ))}
        </div>

        <div className={styles.tools} role="group" aria-label="Drawing tools">
          <div className={styles.toolRow}>{DRAWING_TOOLS.map(toolButton)}</div>
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.toolRow}>
            {toolButton('eraser')}
            <button
              type="button"
              className={styles.tool}
              aria-label="Undo"
              title="Undo"
              disabled={value.strokes.length === 0}
              onClick={() => onChange({ ...value, strokes: value.strokes.slice(0, -1) })}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.tool}
              aria-label="Clear drawing"
              title="Clear"
              disabled={value.strokes.length === 0}
              onClick={() => onChange({ ...value, strokes: [] })}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {shape ? surface : <PolaroidFrame className={styles.polaroid}>{surface}</PolaroidFrame>}
    </div>
  );
}

/** Keep the hint inside the shape's writing area (the whole print for a Polaroid). */
function hintInset(shape: StickyShape | null): CSSProperties {
  if (!shape) return { inset: '12%' };
  const { top, right, bottom, left } = STICKY_SHAPES[shape].content;
  return { inset: `${top}% ${right}% ${bottom}% ${left}%` };
}
