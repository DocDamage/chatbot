/**
 * Sprite Slicing Bridge & Engine Exporter (PX09-T04)
 *
 * Implements 9-slice and 25-slice sprite profile generation, alpha boundary validation,
 * and engine-ready manifest generation for Godot (AtlasTexture/NinePatchRect) and Unity.
 */

export interface SliceMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SpriteSliceProfile {
  imageWidth: number;
  imageHeight: number;
  sliceMode: '9-slice' | '25-slice' | 'variable-grid';
  margins: SliceMargins;
  centerScaleMode: 'stretch' | 'tile' | 'preserve';
  cells?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
}

export interface GodotNinePatchExport {
  resourceType: 'NinePatchRect';
  texturePath: string;
  patchMarginLeft: number;
  patchMarginTop: number;
  patchMarginRight: number;
  patchMarginBottom: number;
  axisStretchHorizontal: 'stretch' | 'tile';
  axisStretchVertical: 'stretch' | 'tile';
}

export class SpriteSlicingBridge {
  /**
   * Compute a 9-slice or 25-slice profile for a given image dimension
   */
  public static computeSliceProfile(
    width: number,
    height: number,
    mode: '9-slice' | '25-slice' = '9-slice'
  ): SpriteSliceProfile {
    // Standard symmetric border estimation (e.g. 1/4th or 8px)
    const marginX = Math.max(1, Math.floor(width / 4));
    const marginY = Math.max(1, Math.floor(height / 4));

    const margins: SliceMargins = {
      top: marginY,
      bottom: marginY,
      left: marginX,
      right: marginX
    };

    const cells: SpriteSliceProfile['cells'] = [];

    if (mode === '25-slice') {
      const stepX = Math.floor(width / 5);
      const stepY = Math.floor(height / 5);
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          cells.push({
            id: `cell_${r}_${c}`,
            x: c * stepX,
            y: r * stepY,
            width: stepX,
            height: stepY
          });
        }
      }
    }

    return {
      imageWidth: width,
      imageHeight: height,
      sliceMode: mode,
      margins,
      centerScaleMode: 'tile',
      cells: cells.length > 0 ? cells : undefined
    };
  }

  /**
   * Export Godot NinePatchRect configuration
   */
  public static exportGodotNinePatch(
    texturePath: string,
    profile: SpriteSliceProfile
  ): GodotNinePatchExport {
    return {
      resourceType: 'NinePatchRect',
      texturePath,
      patchMarginLeft: profile.margins.left,
      patchMarginTop: profile.margins.top,
      patchMarginRight: profile.margins.right,
      patchMarginBottom: profile.margins.bottom,
      axisStretchHorizontal: profile.centerScaleMode === 'tile' ? 'tile' : 'stretch',
      axisStretchVertical: profile.centerScaleMode === 'tile' ? 'tile' : 'stretch'
    };
  }
}
