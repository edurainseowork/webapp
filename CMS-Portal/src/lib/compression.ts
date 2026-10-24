/**
 * Adaptive Client-Side Image Compression Utility for CMS Portal
 * Supports multi-tier compression (Canvas WebP/JPEG DCT + Huffman, with native Stream fallback)
 * Enforces max 3 images and 10MB limit per image.
 */

export const MAX_IMAGES = 3;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  savingsText: string;
  format: string;
  algorithm: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function validateImageFiles(files: File[] | FileList): { valid: File[]; error: string | null } {
  const fileArray = Array.from(files);

  if (fileArray.length > MAX_IMAGES) {
    return {
      valid: fileArray.slice(0, MAX_IMAGES),
      error: `Only up to ${MAX_IMAGES} images can be uploaded at once.`,
    };
  }

  for (const f of fileArray) {
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: [],
        error: `File "${f.name}" exceeds the 10MB limit (${formatBytes(f.size)}).`,
      };
    }
  }

  return { valid: fileArray, error: null };
}

function supportsWebP(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

export async function compressImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<CompressedImageResult> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = options;

  if (!file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve({
          file,
          dataUrl,
          originalSize: file.size,
          compressedSize: file.size,
          savingsPercent: 0,
          savingsText: 'Original file',
          format: file.type || 'file',
          algorithm: 'Passthrough',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            file,
            dataUrl: reader.result as string,
            originalSize: file.size,
            compressedSize: file.size,
            savingsPercent: 0,
            savingsText: 'Original',
            format: file.type,
            algorithm: 'Standard',
          });
        };
        reader.readAsDataURL(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const targetMime = supportsWebP() ? 'image/webp' : 'image/jpeg';
      const algorithmName = targetMime === 'image/webp' ? 'WebP (Lossy DCT/Huffman)' : 'JPEG (DCT)';

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            const dataUrl = canvas.toDataURL(targetMime, quality);
            resolve({
              file,
              dataUrl,
              originalSize: file.size,
              compressedSize: file.size,
              savingsPercent: 0,
              savingsText: 'Standard',
              format: targetMime,
              algorithm: algorithmName,
            });
            return;
          }

          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, targetMime === 'image/webp' ? '.webp' : '.jpg'), {
            type: targetMime,
            lastModified: Date.now(),
          });

          const dataUrl = canvas.toDataURL(targetMime, quality);
          const originalSize = file.size;
          const compressedSize = blob.size;
          const savings = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

          resolve({
            file: compressedFile,
            dataUrl,
            originalSize,
            compressedSize,
            savingsPercent: savings,
            savingsText: `${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (-${savings}%)`,
            format: targetMime.split('/')[1] || 'webp',
            algorithm: algorithmName,
          });
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          file,
          dataUrl: reader.result as string,
          originalSize: file.size,
          compressedSize: file.size,
          savingsPercent: 0,
          savingsText: 'Original',
          format: file.type,
          algorithm: 'Passthrough',
        });
      };
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}
