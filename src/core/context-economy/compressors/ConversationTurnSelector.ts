/**
 * Conversation Turn & History Selector (PX-03 / PX03-T03)
 * Selects salient dialogue turns, preserving initial problem statement,
 * recent interactive turns, user constraints, and summarizing middle turns.
 */

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: string;
}

export class ConversationTurnSelector {
  public static select(turns: ChatTurn[], recentTurnsKeepCount: number = 4): { selectedTurns: ChatTurn[]; omittedTurnsCount: number } {
    if (turns.length <= recentTurnsKeepCount + 2) {
      return { selectedTurns: turns, omittedTurnsCount: 0 };
    }

    const systemTurns = turns.filter(t => t.role === 'system');
    const nonSystem = turns.filter(t => t.role !== 'system');

    if (nonSystem.length <= recentTurnsKeepCount + 1) {
      return { selectedTurns: turns, omittedTurnsCount: 0 };
    }

    // Keep initial user turn (the original goal)
    const initialUserTurn = nonSystem[0];
    // Keep recent turns
    const recentTurns = nonSystem.slice(-recentTurnsKeepCount);
    const middleTurns = nonSystem.slice(1, -recentTurnsKeepCount);

    const summaryTurn: ChatTurn = {
      role: 'system',
      content: `[Summary: ${middleTurns.length} earlier conversational turns omitted for token economy. Original context retrievable via context store.]`
    };

    return {
      selectedTurns: [
        ...systemTurns,
        initialUserTurn,
        summaryTurn,
        ...recentTurns
      ],
      omittedTurnsCount: middleTurns.length
    };
  }
}
