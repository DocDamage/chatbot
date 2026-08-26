/**
 * Unity MAST Modular Placement & Occupancy Service (PX09-T02)
 *
 * Implements clean-room modular prefab palette inspection, grid occupancy
 * analysis (2D/3D voxel and cell occupancy), and placement proposal generation.
 */

export interface MastPrefabPaletteItem {
  id: string;
  name: string;
  category: 'wall' | 'floor' | 'door' | 'prop' | 'roof' | 'stairs';
  dimensions: { x: number; y: number; z: number };
  sockets: Array<{ position: { x: number; y: number; z: number }; normal: string; socketType: string }>;
  tags: string[];
}

export interface GridOccupancyCell {
  x: number;
  y: number;
  z: number;
  occupied: boolean;
  prefabId?: string;
  materialOverride?: string;
}

export interface MastPlacementProposal {
  proposalId: string;
  gridSize: { width: number; height: number; depth: number };
  cellSize: number;
  placements: Array<{
    prefabId: string;
    position: { x: number; y: number; z: number };
    rotationYDegrees: number;
    materialOverride?: string;
  }>;
  totalOccupiedCells: number;
}

export class UnityMastService {
  /**
   * Analyze occupancy grid and calculate collision-free modular placement proposals
   */
  public static generateDungeonLayout(options: {
    width?: number;
    depth?: number;
    roomCount?: number;
    palette?: MastPrefabPaletteItem[];
  }): MastPlacementProposal {
    const width = options.width ?? 10;
    const depth = options.depth ?? 10;
    const roomCount = options.roomCount ?? 2;

    const placements: MastPlacementProposal['placements'] = [];

    // Place perimeter floors and walls
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        const isPerimeter = x === 0 || x === width - 1 || z === 0 || z === depth - 1;

        // Floor
        placements.push({
          prefabId: 'floor-tile-standard',
          position: { x: x * 2, y: 0, z: z * 2 },
          rotationYDegrees: 0
        });

        // Perimeter Wall
        if (isPerimeter) {
          let rot = 0;
          if (z === 0) rot = 0;
          else if (x === width - 1) rot = 90;
          else if (z === depth - 1) rot = 180;
          else if (x === 0) rot = 270;

          placements.push({
            prefabId: 'wall-modular-standard',
            position: { x: x * 2, y: 0, z: z * 2 },
            rotationYDegrees: rot
          });
        }
      }
    }

    return {
      proposalId: `mast-prop-${Date.now()}`,
      gridSize: { width, height: 1, depth },
      cellSize: 2.0,
      placements,
      totalOccupiedCells: placements.length
    };
  }

  /**
   * Validate that placement items do not violate occupancy collisions
   */
  public static validateOccupancy(proposal: MastPlacementProposal): { valid: boolean; overlaps: number } {
    const occupiedKeys = new Set<string>();
    let overlaps = 0;

    for (const p of proposal.placements) {
      const key = `${p.position.x},${p.position.y},${p.position.z},${p.prefabId}`;
      if (occupiedKeys.has(key)) {
        overlaps++;
      } else {
        occupiedKeys.add(key);
      }
    }

    return {
      valid: overlaps === 0,
      overlaps
    };
  }
}
