import { useLayoutEffect, useState, type RefObject } from 'react';
import { computeWallLayout, type WallLayout } from './layout';

interface WallViewportState {
  layout: WallLayout;
  /** How much of the view fits on screen at once, in wall units. */
  visibleWidth: number;
  visibleHeight: number;
}

/**
 * Tracks how the wall is laid out in its scroll container: whole and scaled
 * to the width, or folded into strips on narrow screens. Either way it only
 * ever scrolls vertically, so the intro stays centred at any width.
 */
export function useWallViewport(containerRef: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<WallViewportState | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const layout = computeWallLayout(container.clientWidth);
      setState({
        layout,
        visibleWidth: container.clientWidth / layout.scale,
        visibleHeight: container.clientHeight / layout.scale,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return state;
}
