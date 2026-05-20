import { HumanLanguageRouter } from '../HumanLanguageRouter';

describe('FL Studio slang routing', () => {
  const router = new HumanLanguageRouter();

  it('routes pan slang into FL Studio control', () => {
    const result = router.route({ message: 'turn my drums down a lil and throw the melody left' });

    expect(result.route).toBe('fl_studio_control');
    expect(result.intent).toBe('mixer.adjust');
    expect(result.slots.target).toBe('melody');
    expect(result.slots.direction).toBe('left');
  });

  it('routes mute slang safely as a control action', () => {
    const result = router.route({ message: 'kill the melody for a second' });

    expect(result.route).toBe('fl_studio_control');
    expect(result.intent).toBe('fl_studio_control.mute');
    expect(result.slots.action).toBe('mute');
  });
});
