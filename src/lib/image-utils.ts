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
