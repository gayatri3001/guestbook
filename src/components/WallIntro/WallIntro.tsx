import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { INTRO_WIDTH, type WallRect } from '../../wall/geometry';
import type { WallObstacles } from '../../wall/placement';
import { Button } from '../Button/Button';
import styles from './WallIntro.module.css';

interface WallIntroProps {
  /** Where the intro's centre sits on the surface (centred across, 40% down the screen). */
  centerX: number;
  centerY: number;
  /**
   * Widest the copy may be, in wall units. On phones less of the wall is on
   * screen at once, so the heading and body shrink to fit it.
   */
  fitWidth: number;
  onAddMark?: (() => void) | undefined;
  /** True while the visitor is placing a note they just made. */
  addDisabled?: boolean | undefined;
  /** Reports where the heading, subtitle and CTA landed on the surface, for the placement rules. */
  onLayout: (obstacles: WallObstacles) => void;
}

/**
 * Intro copy and the "Add yours" CTA, centred across the screen and 40% of
 * the way down it, on any device. Laid out in surface units like everything
 * else on the wall.
 */
export function WallIntro({ centerX, centerY, fitWidth, onAddMark, addDisabled = false, onLayout }: WallIntroProps) {
  const ref = useRef<HTMLElement>(null);
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;

  const style = {
    left: centerX,
    top: centerY,
    width: INTRO_WIDTH,
    '--intro-fit': `${Math.min(INTRO_WIDTH, fitWidth)}px`,
  } as CSSProperties;

  // Measure the rendered heading, subtitle and button in surface units.
  useLayoutEffect(() => {
    const intro = ref.current;
    const surface = intro?.parentElement;
    if (!intro || !surface) return;

    const measure = () => {
      const origin = surface.getBoundingClientRect();
      const scale = origin.width / surface.offsetWidth;
      if (!scale) return;
      const toSurface = (r: DOMRect): WallRect => ({
        left: (r.left - origin.left) / scale,
        top: (r.top - origin.top) / scale,
        width: r.width / scale,
        height: r.height / scale,
      });
      // Text boxes hug the glyphs (not the full-width block).
      const textRect = (el: Element | null) => {
        if (!el) return null;
        const range = document.createRange();
        range.selectNodeContents(el);
        return toSurface(range.getBoundingClientRect());
      };
      const text = [textRect(intro.querySelector('h1')), textRect(intro.querySelector('p'))].filter(
        (r): r is WallRect => r !== null,
      );
      const button = intro.querySelector('button');
      onLayoutRef.current({ text, cta: button ? toSurface(button.getBoundingClientRect()) : null });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(intro);
    void document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [centerX, centerY, fitWidth]);

  return (
    <header ref={ref} className={styles.intro} style={style}>
      <h1 className={styles.title}>Leave your mark</h1>
      <p className={styles.body}>Leave a sticky note or polaroid for me, and whoever comes next :)</p>
      <Button className={styles.cta} onClick={onAddMark} disabled={addDisabled}>
        Add yours
      </Button>
    </header>
  );
}
