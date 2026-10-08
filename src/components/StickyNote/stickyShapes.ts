import type { StickyShape } from '../../domain/guestbook';

/**
 * Die-cut silhouettes for each sticky shape, drawn in a 100 × 100 box that
 * is stretched to the note's footprint. `content` is the inset (percent)
 * of the area where writing and doodles can safely sit inside the shape.
 */
export interface StickyShapeDefinition {
  parts: { d: string; transform?: string }[];
  content: { top: number; right: number; bottom: number; left: number };
}

const CLOVER_LEAF =
  'M50 50 C31 44 15 32 21 17 C26 5 44 3 50 21 C56 3 74 5 79 17 C85 32 69 44 50 50 Z';

export const STICKY_SHAPES: Record<StickyShape, StickyShapeDefinition> = {
  square: {
    parts: [
      // Very slight lift on the bottom-right corner where the paper curls.
      { d: 'M0.6 0 H99.4 Q100 0 100 0.6 V96.5 Q99.4 99.3 95.5 100 H0.6 Q0 100 0 99.4 V0.6 Q0 0 0.6 0 Z' },
    ],
    content: { top: 11, right: 10, bottom: 9, left: 10 },
  },
  apple: {
    parts: [
      {
        d: 'M50 25 C43 17 24 14 13 28 C2 43 6 70 20 85 C30 96 41 97 50 92 C59 97 70 96 80 85 C94 70 98 43 87 28 C76 14 57 17 50 25 Z',
      },
      // Leaf and stem are part of the same die-cut sheet.
      { d: 'M52 21 C55 9 66 3 78 5 C74 15 64 21 52 21 Z' },
      { d: 'M48.6 25 C48.6 17 49.8 11 52.8 5.6 L55.4 6.8 C52.6 12 51.6 18 51.6 25 Z' },
    ],
    content: { top: 33, right: 19, bottom: 15, left: 19 },
  },
  clover: {
    parts: [
      { d: CLOVER_LEAF },
      { d: CLOVER_LEAF, transform: 'rotate(90 50 50)' },
      { d: CLOVER_LEAF, transform: 'rotate(180 50 50)' },
      { d: CLOVER_LEAF, transform: 'rotate(270 50 50)' },
      { d: 'M50 33 A17 17 0 1 1 49.99 33 Z' },
      { d: 'M60 63 C67 73 73 84 80 95 L83.4 93.2 C76.4 82 70 71 63.4 60.6 Z' },
    ],
    content: { top: 25, right: 24, bottom: 25, left: 24 },
  },
};
