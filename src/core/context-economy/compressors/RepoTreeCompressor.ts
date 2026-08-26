/**
 * Repository Tree & File Directory Compressor (PX-03 / PX03-T03)
 * Compresses deep filesystem trees to depth ceilings and focuses on
 * target modules/files while preserving child count annotations.
 */

export class RepoTreeCompressor {
  public static compress(treeText: string, maxDepth: number = 3, focusPaths: string[] = []): { compressed: string; prunedEntriesCount: number } {
    const lines = treeText.split('\n');
    const output: string[] = [];
    let prunedCount = 0;

    for (const line of lines) {
      if (line.trim().length === 0) continue;

      // Calculate depth by indentation (2 spaces or 4 spaces or tree characters)
      const indentMatch = line.match(/^([ │├└─\s]*)/);
      const indentStr = indentMatch ? indentMatch[1] : '';
      const depth = Math.floor(indentStr.length / 2);

      const isFocused = focusPaths.some(p => line.includes(p));

      if (depth > maxDepth && !isFocused) {
        prunedCount++;
        continue;
      }

      output.push(line);
    }

    if (prunedCount > 0) {
      output.push(`... [${prunedCount} deeper file tree entries omitted]`);
    }

    return {
      compressed: output.join('\n'),
      prunedEntriesCount: prunedCount
    };
  }
}
