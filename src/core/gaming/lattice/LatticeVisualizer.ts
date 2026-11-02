/**
 * Lattice Accessible & Visual Representations (CF-08)
 *
 * Provides non-visual text/ASCII matrices, markdown entity tables,
 * and lightweight 2D/isometric SVG previews for screen-reader and visual inspection.
 */

import { LatticeWorldSchema, LatticeEntity, LatticeTile } from './LatticeWorldSchema';

export class LatticeVisualizer {
  /**
   * Render an accessible 2D ASCII grid of the world
   */
  public static renderAsciiGrid(world: LatticeWorldSchema): string {
    const { width, height } = world.dimensions;
    const grid: string[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => '.')
    );

    // Render tiles
    for (const tile of world.tiles) {
      if (tile.y >= 0 && tile.y < height && tile.x >= 0 && tile.x < width) {
        grid[tile.y][tile.x] = this.getTileChar(tile.type, tile.walkable);
      }
    }

    // Render entities
    for (const entity of world.entities) {
      if (entity.state === 'defeated') continue;
      const { x, y } = entity.position;
      if (y >= 0 && y < height && x >= 0 && x < width) {
        grid[y][x] = this.getEntityChar(entity.archetype);
      }
    }

    const header = `Lattice World (${width}x${height}) — Seed: ${world.seed}\n`;
    const rows = grid.map((row, idx) => `${String(idx).padStart(2, '0')} | ${row.join(' ')}`).join('\n');
    const footer = `\nLegend: [P] Player, [E] Enemy, [N] NPC, [*] Item, [#] Wall, [~] Water, [.] Walkable`;

    return header + rows + footer;
  }

  /**
   * Render a tabular list of entities for non-visual and accessibility inspection
   */
  public static renderEntityTable(entities: LatticeEntity[]): string {
    const header = '| ID | Name | Archetype | Position (x,y,z) | HP / Max | State |\n|---|---|---|---|---|---|';
    const rows = entities.map(e =>
      `| ${e.id} | ${e.name} | ${e.archetype} | (${e.position.x}, ${e.position.y}, ${e.position.z}) | ${e.stats.hp}/${e.stats.maxHp} | ${e.state} |`
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Render a lightweight 2D isometric SVG preview
   */
  public static renderIsometricSvg(
    world: LatticeWorldSchema,
    options?: { tileWidth?: number; tileHeight?: number }
  ): string {
    const tileW = options?.tileWidth ?? 64;
    const tileH = options?.tileHeight ?? 32;
    const { width, height } = world.dimensions;

    const svgWidth = (width + height) * (tileW / 2) + 100;
    const svgHeight = (width + height) * (tileH / 2) + 120;
    const originX = height * (tileW / 2) + 50;
    const originY = 50;

    let tileSvg = '';
    for (const tile of world.tiles) {
      const isoX = originX + (tile.x - tile.y) * (tileW / 2);
      const isoY = originY + (tile.x + tile.y) * (tileH / 2) - (tile.elevation * 8);
      const color = this.getTileColor(tile.type);

      tileSvg += `  <polygon points="${isoX},${isoY} ${isoX + tileW / 2},${isoY + tileH / 2} ${isoX},${isoY + tileH} ${isoX - tileW / 2},${isoY + tileH / 2}" fill="${color}" stroke="#333" stroke-width="1" />\n`;
    }

    let entitySvg = '';
    for (const entity of world.entities) {
      if (entity.state === 'defeated') continue;
      const isoX = originX + (entity.position.x - entity.position.y) * (tileW / 2);
      const isoY = originY + (entity.position.x + entity.position.y) * (tileH / 2) - (entity.position.z * 8) + (tileH / 2);
      const color = this.getEntityColor(entity.archetype);

      entitySvg += `  <circle cx="${isoX}" cy="${isoY - 10}" r="12" fill="${color}" stroke="#ffffff" stroke-width="2" />\n`;
      entitySvg += `  <text x="${isoX}" y="${isoY - 6}" font-size="10" text-anchor="middle" fill="#ffffff" font-family="sans-serif">${entity.archetype[0].toUpperCase()}</text>\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
  <rect width="100%" height="100%" fill="#1a1a24" />
  <g id="tiles">
${tileSvg}  </g>
  <g id="entities">
${entitySvg}  </g>
</svg>`;
  }

  private static getTileChar(type: string, walkable: boolean): string {
    switch (type) {
      case 'wall': return '#';
      case 'water': return '~';
      case 'stone': return 'S';
      case 'grass': return '.';
      case 'sand': return ':';
      default: return walkable ? '.' : '#';
    }
  }

  private static getEntityChar(archetype: string): string {
    switch (archetype) {
      case 'player': return 'P';
      case 'enemy': return 'E';
      case 'npc': return 'N';
      case 'item': return '*';
      case 'obstacle': return 'X';
      default: return '?';
    }
  }

  private static getTileColor(type: string): string {
    switch (type) {
      case 'grass': return '#4caf50';
      case 'water': return '#2196f3';
      case 'stone': return '#9e9e9e';
      case 'sand': return '#ffeb3b';
      case 'wall': return '#607d8b';
      default: return '#795548';
    }
  }

  private static getEntityColor(archetype: string): string {
    switch (archetype) {
      case 'player': return '#3f51b5';
      case 'enemy': return '#f44336';
      case 'npc': return '#009688';
      case 'item': return '#ff9800';
      default: return '#9c27b0';
    }
  }
}
