/**
 * An error with a message that's fine to show visitors as-is. Anything
 * else that goes wrong is shown with a generic fallback.
 */
export class GuestbookError extends Error {
  constructor(readonly userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.name = 'GuestbookError';
  }
}

export function userMessageFor(error: unknown, fallback: string): string {
  return error instanceof GuestbookError ? error.userMessage : fallback;
}
