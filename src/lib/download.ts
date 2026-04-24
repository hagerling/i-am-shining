/**
 * Save an image from a canvas.
 *
 * On iOS / Android: opens the native share sheet with JUST the image file
 * (no title/text — passing those makes iOS treat it like a URL-share and
 * hides the "Save Image" / Photos action). The user taps "Save Image" to
 * add it to their Photos library.
 *
 * On desktop: falls back to a traditional <a download> click.
 */
export function saveCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string,
): void {
  canvas.toBlob(async (blob) => {
    if (!blob) return;

    // Detect a "real" desktop: hover-capable + fine pointer (mouse/trackpad).
    // macOS Safari supports navigator.share() with files, but on a mouse-based
    // desktop that opens a share sheet instead of the expected "save as"
    // download flow. We want the browser's native download on desktop, and
    // Web Share only on touch devices (iOS / iPadOS / Android) where it
    // reaches "Save to Photos".
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const file = new File([blob], filename, { type: 'image/png' });

    if (
      !isDesktop &&
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      // Mobile: open the native share sheet (iOS → "Save Image" → Photos)
      // IMPORTANT: pass only `files`; adding title/text/url downgrades the
      // share to a URL share on iOS and removes the Save Image option.
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Fall through to traditional download on other errors.
      }
    }

    // Desktop + fallback: standard browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, 'image/png');
}

/** True when we're on an iOS device (iPhone, iPad, iPod). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS reports itself as "Mac" but supports touch
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
