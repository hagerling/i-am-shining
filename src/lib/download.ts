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

/**
 * Save MULTIPLE canvases as PNG files.
 * - On mobile (Web Share with files): a single share sheet listing all files,
 *   so the user gets one prompt for "Save to Photos" that saves both.
 * - On desktop: triggers sequential <a download> clicks; the browser saves each
 *   file with its given filename.
 */
export async function saveCanvasImages(
  items: { canvas: HTMLCanvasElement; filename: string }[],
): Promise<void> {
  if (!items.length) return;

  // Convert all canvases to blobs in parallel
  const files = await Promise.all(
    items.map(
      ({ canvas, filename }) =>
        new Promise<File | null>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) return resolve(null);
            resolve(new File([blob], filename, { type: 'image/png' }));
          }, 'image/png');
        }),
    ),
  );
  const validFiles = files.filter((f): f is File => f !== null);
  if (!validFiles.length) return;

  const isDesktop =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (
    !isDesktop &&
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: validFiles })
  ) {
    try {
      await navigator.share({ files: validFiles });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      // fall through to download
    }
  }

  // Desktop / fallback: trigger each download sequentially with a small gap
  for (const file of validFiles) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    // Small gap so the browser doesn't drop the second download
    await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * Save a canvas as an SVG file.
 * Embeds the canvas raster as a base64 <image> inside an SVG wrapper
 * so users get an .svg file that can be opened in vector editors.
 */
export function saveCanvasAsSVG(
  canvas: HTMLCanvasElement,
  filename: string,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const dataUrl = canvas.toDataURL('image/png');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image width="${w}" height="${h}" xlink:href="${dataUrl}" />
</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** True when we're on an iOS device (iPhone, iPad, iPod). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS reports itself as "Mac" but supports touch
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
