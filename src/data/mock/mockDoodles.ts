import { DOODLE_CANVAS_SIZE, type DoodleData, type DoodleStroke } from '../../domain/guestbook';

/**
 * Deterministic placeholder doodles in the same format the doodle editor
 * will eventually produce. Generated from simple curves plus seeded jitter
 * so they look hand-drawn but are identical on every load.
 */

type Point = [number, number];

function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function toStroke(points: Point[], rand: () => number, color: string, width = 2.6, wobble = 0.7): DoodleStroke {
  const max = DOODLE_CANVAS_SIZE;
  return {
    tool: 'pen',
    color,
    width,
    points: points.flatMap(([x, y]) => [
      Math.round(Math.min(max, Math.max(0, x + (rand() - 0.5) * 2 * wobble)) * 10) / 10,
      Math.round(Math.min(max, Math.max(0, y + (rand() - 0.5) * 2 * wobble)) * 10) / 10,
    ]),
  };
}

function arc(cx: number, cy: number, r: number, from = 0, to = Math.PI * 2, steps = 28): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

function heartCurve(cx: number, cy: number, size: number): Point[] {
  return Array.from({ length: 41 }, (_, i) => {
    const t = (Math.PI * 2 * i) / 40;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [cx + (x * size) / 16, cy - (y * size) / 16];
  });
}

function doodle(
  seed: number,
  color: string,
  build: (s: (points: Point[], width?: number) => DoodleStroke) => DoodleStroke[],
): DoodleData {
  const rand = seededRandom(seed);
  return { version: 1, strokes: build((points, width) => toStroke(points, rand, color, width)) };
}

const INK = '#2b2a33';
const BLUE_PEN = '#2f4fb5';
const RED_PEN = '#b8392a';
const GREEN_PEN = '#2f6e48';
const ORANGE_PEN = '#c27a12';

export const heartDoodle = doodle(11, RED_PEN, (s) => [
  s(heartCurve(50, 52, 30), 3),
  s([[80, 18], [86, 12]]),
  s([[84, 26], [92, 24]]),
  s([[18, 20], [12, 14]]),
]);

export const smileyDoodle = doodle(23, INK, (s) => [
  s(arc(50, 50, 34, -1.4, Math.PI * 2 - 1.3, 36), 3),
  s([[38, 36], [38, 46]], 3.4),
  s([[62, 36], [62, 46]], 3.4),
  s(arc(50, 52, 20, 0.35, Math.PI - 0.35, 16), 3),
]);

export const sunDoodle = doodle(37, ORANGE_PEN, (s) => [
  s(arc(50, 50, 17, 0, Math.PI * 2, 24), 3),
  ...Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10;
    return s([
      [50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26],
      [50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38],
    ]);
  }),
]);

export const catDoodle = doodle(41, INK, (s) => [
  s(arc(50, 56, 27, -0.9, Math.PI * 2 - 0.9, 32), 2.8),
  s([[29, 42], [30, 18], [45, 31]]),
  s([[55, 31], [70, 18], [71, 42]]),
  s(arc(40, 53, 2.6, 0, Math.PI * 2, 8), 2.4),
  s(arc(60, 53, 2.6, 0, Math.PI * 2, 8), 2.4),
  s([[47, 62], [53, 62], [50, 66], [47, 62]], 2.2),
  s([[50, 66], [46, 71]], 2.2),
  s([[50, 66], [54, 71]], 2.2),
  s([[36, 63], [16, 59]], 1.8),
  s([[36, 67], [16, 70]], 1.8),
  s([[64, 63], [84, 59]], 1.8),
  s([[64, 67], [84, 70]], 1.8),
]);

export const starDoodle = doodle(53, BLUE_PEN, (s) => [
  s(
    Array.from({ length: 11 }, (_, i): Point => {
      const r = i % 2 === 0 ? 38 : 16;
      const a = -Math.PI / 2 + (Math.PI * i) / 5;
      return [50 + Math.cos(a) * r, 54 + Math.sin(a) * r];
    }),
    3,
  ),
  s([[84, 14], [84, 24]], 2),
  s([[79, 19], [89, 19]], 2),
]);

export const flowerDoodle = doodle(67, GREEN_PEN, (s) => [
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 6;
    return s(arc(50 + Math.cos(a) * 14, 38 + Math.sin(a) * 14, 9.5, 0, Math.PI * 2, 16), 2.4);
  }),
  s(arc(50, 38, 5, 0, Math.PI * 2, 12), 2.4),
  s([[50, 56], [49, 74], [50, 94]], 2.6),
  s([[50, 80], [60, 70], [70, 70], [62, 80], [50, 80]], 2.2),
]);

export const wavesDoodle = doodle(79, BLUE_PEN, (s) => [
  ...[46, 60, 74].map((y) =>
    s(
      Array.from({ length: 25 }, (_, i): Point => [8 + i * 3.5, y + Math.sin(i * 0.9) * 4]),
      2.6,
    ),
  ),
  s(arc(76, 24, 9, 0, Math.PI * 2, 16), 2.4),
]);

/** Scale and move a doodle into a box (doodle units), e.g. above a note's writing. */
export function fitDoodle(source: DoodleData, box: { x: number; y: number; size: number }): DoodleData {
  const scale = box.size / DOODLE_CANVAS_SIZE;
  return {
    ...source,
    strokes: source.strokes.map((stroke) => ({
      ...stroke,
      width: Math.round(stroke.width * Math.max(scale, 0.75) * 10) / 10,
      points: stroke.points.map((value, i) => Math.round((i % 2 === 0 ? box.x : box.y) * 10 + value * scale * 10) / 10),
    })),
  };
}
