export class CharacterArcTool {
  run(input: Record<string, any> = {}) {
    const role = String(input.role || 'protagonist');
    const wound = String(input.wound || 'they learned survival matters more than trust');
    const want = String(input.want || 'control');
    const need = String(input.need || 'connection');
    return {
      domain: 'story',
      tool: 'CharacterArcTool',
      role,
      want,
      need,
      wound,
      arc: [
        'Mask: the behavior that protects the wound but causes problems.',
        'Pressure: repeated situations where the mask stops working.',
        'Mirror: another character embodies the cost of never changing.',
        'Choice: the character sacrifices the want to claim the need.',
        'Proof: the final action shows the new value under pressure.'
      ],
      questions: [
        `What does the ${role} do when they feel they are losing ${want}?`,
        `Who benefits if they never learn ${need}?`,
        'What small habit visibly changes by the ending?'
      ]
    };
  }
}
