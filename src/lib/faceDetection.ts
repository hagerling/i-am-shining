// Face landmark detection via MediaPipe — used to find the user's eyes and
// mouth in the uploaded photo so the sparkle overlay can avoid covering them.
//
// The MediaPipe library + WASM + model are ~3–5 MB. We lazy-load everything
// via a dynamic import from the component — this file is only pulled in once
// a photo is uploaded, so visitors who never upload pay nothing.

import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

/**
 * A rectangular region of interest in NORMALISED image coordinates (0–1).
 * `w` and `h` are width and height as fractions of the natural image size.
 */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bounding boxes for the eyes and mouth in the uploaded photo. */
export interface FaceZones {
  leftEye:  NormRect;
  rightEye: NormRect;
  mouth:    NormRect;
}

// MediaPipe Face Mesh standard landmark indices — see
// https://github.com/google/mediapipe/blob/master/mediapipe/python/solutions/face_mesh_connections.py
const LEFT_EYE  = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const MOUTH     = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

// Singleton — share one landmarker across the session
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      );
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        numFaces: 1,
        runningMode: 'IMAGE',
      });
    })();
  }
  return landmarkerPromise;
}

function bbox(
  landmarks: FaceLandmarkerResult['faceLandmarks'][number],
  indices:   number[],
  padX:      number,
  padY:      number,
): NormRect {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const i of indices) {
    const p = landmarks[i];
    if (!p) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return {
    x: Math.max(0, minX - w * padX),
    y: Math.max(0, minY - h * padY),
    w: Math.min(1, w * (1 + 2 * padX)),
    h: Math.min(1, h * (1 + 2 * padY)),
  };
}

/**
 * Detect eyes and mouth in the given image.
 * Returns `null` on any failure (no face found, model couldn't load, etc.).
 * The caller should treat that as "no exclusion" and render normally.
 */
export async function detectFaceZones(img: HTMLImageElement): Promise<FaceZones | null> {
  try {
    const landmarker = await getLandmarker();
    const result = landmarker.detect(img);
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null;
    const lm = result.faceLandmarks[0];
    return {
      // Generous padding — the eye and mouth bounding boxes are tight by
      // default (just the feature outline). Padding here, plus the
      // sparkle's own glow-radius buffer at draw time, guarantees nothing
      // golden ever falls on an eye or lip.
      leftEye:  bbox(lm, LEFT_EYE,  0.60, 1.30),
      rightEye: bbox(lm, RIGHT_EYE, 0.60, 1.30),
      mouth:    bbox(lm, MOUTH,     0.35, 0.70),
    };
  } catch (err) {
    // Don't crash the editor if detection fails — degrade gracefully
    console.warn('[faceDetection] detection failed:', err);
    return null;
  }
}
