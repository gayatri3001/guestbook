import { hasDoodleContent, type GuestbookEntry, type StickyShape } from './guestbook';

/**
 * How much handwriting fits on each sheet, and how a long note is split.
 *
 * Visitors only see the word limit. Behind the scenes, whatever doesn't fit
 * on the chosen surface continues onto extra square stickies, as many as it
 * takes (in practice one, occasionally two).
 */

export const MAX_MESSAGE_WORDS = 50;

/**
 * A safety net for pathological input (very long "words"); at 50 normal
 * words it is never reached, so it isn't shown as a limit.
 */
export const MAX_MESSAGE_CHARS = 320;

/** Characters that fit legibly on each extra square sticky. */
export const CONTINUATION_CAPACITY = 125;

export type MessageSurface =
  | { type: 'sticky'; shape: StickyShape; hasDoodle: boolean }
  | { type: 'polaroid'; name: string | null };

/** Characters that fit on the entry's own surface before continuing. */
export function primaryCapacity(surface: MessageSurface): number {
  if (surface.type === 'polaroid') {
    // Two caption lines, shared with the "— name" signature.
    return Math.max(12, 44 - (surface.name ? surface.name.length + 3 : 0));
  }
  if (surface.hasDoodle) return 32;
  return surface.shape === 'square' ? 110 : 60;
}

export function surfaceOf(entry: GuestbookEntry): MessageSurface {
  return entry.type === 'polaroid'
    ? { type: 'polaroid', name: entry.name }
    : { type: 'sticky', shape: entry.shape, hasDoodle: hasDoodleContent(entry.doodle) };
}

export interface MessageSplit {
  primary: string | null;
  /** Text for each extra sticky, in order; empty when it all fits. */
  continuations: string[];
}

/** Take as much as fits in `capacity`, breaking at a word boundary. */
function takeChunk(text: string, capacity: number): [string, string] {
  if (text.length <= capacity) return [text, ''];
  let cut = text.lastIndexOf(' ', capacity);
  if (cut <= 0) cut = capacity; // A single very long word: hard break.
  return [text.slice(0, cut).trimEnd(), text.slice(cut).trimStart()];
}

export function splitMessage(message: string | null, primaryCap: number): MessageSplit {
  const text = message?.trim() ?? '';
  if (!text) return { primary: null, continuations: [] };

  const [primary, rest] = takeChunk(text, primaryCap);
  const continuations: string[] = [];
  let remaining = rest;
  while (remaining) {
    const [chunk, next] = takeChunk(remaining, CONTINUATION_CAPACITY);
    continuations.push(chunk);
    remaining = next;
  }
  return { primary, continuations };
}

export function splitEntryMessage(entry: GuestbookEntry): MessageSplit {
  return splitMessage(entry.message, primaryCapacity(surfaceOf(entry)));
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export type MessageProblem = 'too-many-words' | 'too-long';

export function checkMessage(message: string): MessageProblem | null {
  if (countWords(message) > MAX_MESSAGE_WORDS) return 'too-many-words';
  if (message.trim().length > MAX_MESSAGE_CHARS) return 'too-long';
  return null;
}
