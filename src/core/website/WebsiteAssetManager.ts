/**
 * Phase PX-16: Website Asset Manager
 * PX16-T04
 */

import { v4 as uuidv4 } from 'uuid';
import { WebsiteAsset, WebsiteProjectSchema } from './WebsiteTypes';

export interface RegisterAssetInput {
  name: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  url: string;
  altText: string;
  focalPoint?: { x: number; y: number };
  isRemote?: boolean;
  approvedForRemoteLoad?: boolean;
}

export class WebsiteAssetManager {
  private assets: Map<string, WebsiteAsset> = new Map();

  constructor(initialAssets: WebsiteAsset[] = []) {
    for (const a of initialAssets) {
      this.assets.set(a.id, a);
    }
  }

  public registerAsset(input: RegisterAssetInput): WebsiteAsset {
    // Check remote safety
    const isRemote = input.isRemote || /^https?:\/\//i.test(input.url);
    if (isRemote && !input.approvedForRemoteLoad) {
      throw new Error(
        `Remote asset '${input.url}' requires explicit user approval before loading in workspace`
      );
    }

    const safeName = input.name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .slice(0, 100);

    const assetId = `asset-${uuidv4()}`;
    const asset: WebsiteAsset = {
      id: assetId,
      name: safeName,
      originalName: input.name,
      mimeType: input.mimeType || 'image/png',
      byteSize: input.byteSize || 0,
      width: input.width || 800,
      height: input.height || 600,
      url: input.url,
      altText: input.altText?.trim() || safeName,
      focalPoint: input.focalPoint || { x: 0.5, y: 0.5 },
      uploadedAt: new Date().toISOString(),
      isRemote,
      approvedForRemoteLoad: input.approvedForRemoteLoad ?? !isRemote,
      responsiveVariants: [
        { width: 375, height: Math.round((375 / (input.width || 800)) * (input.height || 600)), url: `${input.url}?w=375`, format: 'webp' },
        { width: 768, height: Math.round((768 / (input.width || 800)) * (input.height || 600)), url: `${input.url}?w=768`, format: 'webp' },
        { width: 1280, height: Math.round((1280 / (input.width || 800)) * (input.height || 600)), url: `${input.url}?w=1280`, format: 'webp' }
      ]
    };

    this.assets.set(asset.id, asset);
    return JSON.parse(JSON.stringify(asset));
  }

  public listAssets(): WebsiteAsset[] {
    return Array.from(this.assets.values());
  }

  public getAsset(assetId: string): WebsiteAsset | undefined {
    return this.assets.get(assetId);
  }

  public updateAssetMetadata(
    assetId: string,
    updates: { altText?: string; focalPoint?: { x: number; y: number }; approvedForRemoteLoad?: boolean }
  ): WebsiteAsset {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    if (updates.altText !== undefined) asset.altText = updates.altText.slice(0, 300);
    if (updates.focalPoint !== undefined) asset.focalPoint = updates.focalPoint;
    if (updates.approvedForRemoteLoad !== undefined) asset.approvedForRemoteLoad = updates.approvedForRemoteLoad;

    return JSON.parse(JSON.stringify(asset));
  }

  public deleteAsset(assetId: string): boolean {
    return this.assets.delete(assetId);
  }

  public detectUnusedAssets(project: WebsiteProjectSchema): WebsiteAsset[] {
    const usedUrls = new Set<string>();

    for (const page of project.pages) {
      for (const block of page.blocks) {
        if (block.imageUrl) usedUrls.add(block.imageUrl);
        if (block.videoUrl) usedUrls.add(block.videoUrl);
        if (block.items) {
          for (const item of block.items) {
            if (item.avatarUrl) usedUrls.add(item.avatarUrl);
          }
        }
      }
    }

    const unused: WebsiteAsset[] = [];
    for (const asset of this.assets.values()) {
      if (!usedUrls.has(asset.url) && !usedUrls.has(asset.id)) {
        unused.push(asset);
      }
    }
    return unused;
  }
}
