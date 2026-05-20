import { MixMove } from './MixPlanner';

export class MixPassReport {
  create(input: {
    moves: MixMove[];
    flResult: any;
    beforeSnapshot?: any;
    permissionMode: string;
  }) {
    const automatable = input.moves.filter(move => move.fl);
    return {
      permissionMode: input.permissionMode,
      snapshotCaptured: !!input.beforeSnapshot,
      plannedMoves: input.moves.length,
      automatableMoves: automatable.length,
      appliedMoves: input.flResult?.toolResults?.filter((result: any) => result.ok && !result.dryRun).length || 0,
      dryRunMoves: input.flResult?.toolResults?.filter((result: any) => result.dryRun).length || automatable.length,
      touchedTargets: automatable.map(move => move.target),
      stillNeedsListening: [
        'Render or play through the hook and loudest section.',
        'Check kick/808 relationship on headphones, car, and small speakers.',
        'Level-match against a reference before judging loudness.',
        'Approve any master/plugin/render changes separately.'
      ]
    };
  }
}
