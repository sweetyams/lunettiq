/**
 * Lazy-loaded MediaPipe FaceLandmarker wrapper.
 * Nothing is downloaded until `init()` is called.
 */

import type { FaceLandmarker as FaceLandmarkerType } from '@mediapipe/tasks-vision';

let landmarker: FaceLandmarkerType | null = null;
let initPromise: Promise<FaceLandmarkerType> | null = null;

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export async function init(): Promise<FaceLandmarkerType> {
  if (landmarker) return landmarker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

      // Try GPU first, fall back to CPU
      try {
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch {
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      return landmarker;
    } catch (err) {
      // Reset so user can retry
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export function detect(video: HTMLVideoElement, timestamp: number) {
  if (!landmarker) throw new Error('FaceLandmarker not initialised');
  return landmarker.detectForVideo(video, timestamp);
}

/** Key landmark indices for glasses placement */
export const LANDMARKS = {
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  NOSE_BRIDGE: 168,
  LEFT_EAR: 234,
  RIGHT_EAR: 454,
  FOREHEAD: 10,
  CHIN: 152,
} as const;

export function dispose() {
  landmarker?.close();
  landmarker = null;
  initPromise = null;
}
