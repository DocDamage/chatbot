export class MechanicsDesigner {
  critique(mechanic: string) {
    return {
      mechanic,
      funFactor: 'Depends on readable feedback and meaningful player decisions.',
      playerAgency: 'Add timing, positioning, loadout, or risk/reward choices.',
      balanceRisk: 'Watch for dominant strategies and unclear failure states.',
      testPlan: ['Prototype the smallest loop.', 'Measure completion time and retry rate.', 'Tune numbers from playtest data.']
    };
  }
}
