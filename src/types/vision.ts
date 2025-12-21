/**
 * Vision-Language Types
 */

export interface VisionRequest {
  image: string; // Base64 encoded image
  prompt: string;
  imageUrl?: string;
}

export interface VisionResponse {
  content: string;
  model: string;
  confidence?: number;
  imageAnalysis?: ImageAnalysis;
  tokensUsed?: number;
  cost?: number;
  latency?: number;
}

export interface ImageAnalysis {
  description: string;
  objects: DetectedObject[];
  text?: string; // OCR text
  metadata?: {
    width: number;
    height: number;
    format: string;
  };
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface MultiImageRequest {
  images: string[]; // Base64 encoded images
  prompt: string;
  comparisonType?: 'similarity' | 'difference' | 'analysis';
}

