import { Injectable } from '@angular/core';
import type { FaceLandmarksDetector } from '@tensorflow-models/face-landmarks-detection';
import { Mood } from '../models';

@Injectable({ providedIn: 'root' })
export class EmotionDetectionService {
  private detector?: Promise<FaceLandmarksDetector>;

  async estimate(video: HTMLVideoElement): Promise<Mood | null> {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    const detector = await this.loadDetector();
    const faces = await detector.estimateFaces(video, { flipHorizontal: true });
    const landmarks = faces[0]?.keypoints;
    if (!landmarks || landmarks.length <= 291) return null;

    const left = landmarks[61];
    const right = landmarks[291];
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];
    const mouthWidth = Math.hypot(right.x - left.x, right.y - left.y);
    if (!mouthWidth) return null;

    const cornerHeight = (left.y + right.y) / 2;
    const lipCenter = (upperLip.y + lowerLip.y) / 2;
    const smileCue = (lipCenter - cornerHeight) / mouthWidth;
    const lipCompression = Math.abs(lowerLip.y - upperLip.y) / mouthWidth;

    if (smileCue > 0.035) return 'energetic';
    if (smileCue < -0.025 && lipCompression < 0.035) return 'stressed';
    return 'calm';
  }

  dispose(): void {
    void this.detector?.then((detector) => detector.dispose());
    this.detector = undefined;
  }

  private loadDetector(): Promise<FaceLandmarksDetector> {
    if (!this.detector) {
      this.detector = (async () => {
        const [tf, , , , model] = await Promise.all([
          import('@tensorflow/tfjs-core'),
          import('@tensorflow/tfjs-backend-webgl'),
          import('@tensorflow/tfjs-backend-cpu'),
          import('@tensorflow/tfjs-converter'),
          import('@tensorflow-models/face-landmarks-detection'),
        ]);
        const webglAvailable = await tf.setBackend('webgl').catch(() => false);
        if (!webglAvailable) await tf.setBackend('cpu');
        await tf.ready();
        return model.createDetector(model.SupportedModels.MediaPipeFaceMesh, {
          runtime: 'tfjs',
          maxFaces: 1,
          refineLandmarks: true,
        });
      })();
    }
    return this.detector;
  }
}
