import { describe, it, expect, vi } from 'vitest';
import { ImageService } from '../../src/application/image.service';

describe('ImageService Unit Tests', () => {
  it('converts valid PNG dataUrl to binary Blob', () => {
    const dummyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = ImageService.dataUrlToBlob(dummyPngDataUrl);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('safely handles empty or corrupted dataUrl in dataUrlToBlob', () => {
    const emptyBlob = ImageService.dataUrlToBlob('');
    expect(emptyBlob).toBeInstanceOf(Blob);
    expect(emptyBlob.size).toBe(0);

    const corruptBlob = ImageService.dataUrlToBlob('invalid-non-base64');
    expect(corruptBlob).toBeInstanceOf(Blob);
    expect(corruptBlob.size).toBe(0);
  });

  it('handles fallback in non-browser / headless environment', async () => {
    const dummyBlob = new Blob(['mock binary image'], { type: 'image/png' });
    const result = await ImageService.processImageBlob(dummyBlob);
    expect(result.dataUrl).toBeTruthy();
    expect(result.dimensions.width).toBeGreaterThan(0);
    expect(result.dimensions.height).toBeGreaterThan(0);
  });

  it('handles invalid or non-image blobs gracefully', async () => {
    const textBlob = new Blob(['not an image'], { type: 'text/plain' });
    const result = await ImageService.processImageBlob(textBlob);
    expect(result.dataUrl).toBe('data:image/png;base64,mock');
    expect(result.dimensions.width).toBe(400);
  });

  it('detects barcode / QR code when BarcodeDetector API is present', async () => {
    const mockDetect = vi.fn().mockResolvedValue([{ rawValue: 'https://php.extension.dev' }]);
    // @ts-expect-error Mocking BarcodeDetector
    window.BarcodeDetector = vi.fn().mockImplementation(() => ({
      detect: mockDetect
    }));

    const dummyCanvas = document.createElement('canvas');
    const detected = await ImageService.detectBarcodeOrQr(dummyCanvas);
    expect(detected).toBe('https://php.extension.dev');
    expect(mockDetect).toHaveBeenCalledWith(dummyCanvas);

    // @ts-expect-error Cleanup mock
    delete window.BarcodeDetector;
  });

  it('returns undefined for detectBarcodeOrQr when BarcodeDetector is not available', async () => {
    const dummyCanvas = document.createElement('canvas');
    const detected = await ImageService.detectBarcodeOrQr(dummyCanvas);
    expect(detected).toBeUndefined();
  });
});
