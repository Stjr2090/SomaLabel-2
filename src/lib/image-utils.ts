/**
 * Client-side image utilities for SomaLabel
 * - Resizes images to max 1024px on the long edge
 * - Converts to JPEG at quality 0.8 for processing in memory
 * - Avoids storing or caching images on disk
 */

export interface ProcessedImage {
  base64: string; // Pure base64 data string (no data: prefix)
  dataUrl: string; // Complete data: URL for local preview in UI
  mimeType: string;
  width: number;
  height: number;
}

export function resizeImageFile(
  file: File | Blob,
  maxDimension: number = 1024,
  quality: number = 0.80
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read the selected image file.'));
    };

    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) {
        return reject(new Error('Empty image file.'));
      }

      const img = new Image();
      img.onerror = () => {
        reject(new Error('Failed to decode image data.'));
      };

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate proportional scale
        const maxEdge = Math.max(width, height);
        if (maxEdge > maxDimension) {
          const scale = maxDimension / maxEdge;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context not available.'));
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG data URL
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.split(',')[1];

        resolve({
          base64,
          dataUrl,
          mimeType,
          width,
          height,
        });
      };

      img.src = src;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Prepares a photo for OCR only. Never uploaded.
 *
 * OCR does better with more pixels and more contrast: the label is upscaled
 * (at most 2x, to a 1600px long edge), converted to grayscale and stretched
 * around mid-grey. A blurry or dim phone photo that reads as noise at 1024px
 * often becomes legible here.
 */
export function prepareForOcr(
  dataUrl: string,
  targetLongEdge: number = 1600
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Failed to decode image data for OCR.'));
    img.onload = () => {
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      const longEdge = Math.max(srcW, srcH);
      const scale = longEdge >= targetLongEdge ? 1 : Math.min(2, targetLongEdge / longEdge);
      const width = Math.max(1, Math.round(srcW * scale));
      const height = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Canvas 2D context not available.'));
        return;
      }

      // White matte, so transparent PNGs are not read as black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const frame = ctx.getImageData(0, 0, width, height);
        const px = frame.data;
        const contrast = 1.8;
        for (let i = 0; i < px.length; i += 4) {
          const luminance = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          const stretched = Math.min(255, Math.max(0, (luminance - 128) * contrast + 128));
          px[i] = stretched;
          px[i + 1] = stretched;
          px[i + 2] = stretched;
        }
        ctx.putImageData(frame, 0, 0);
      } catch {
        // If pixel access is blocked, the greyscale pass is skipped; the
        // upscaled colour image is still better than nothing.
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}
