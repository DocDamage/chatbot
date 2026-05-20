import { AudioAnalyzerTool } from '../../../tools/audio/AudioAnalyzerTool';
import { DynamicRangeTool } from '../../../tools/audio/DynamicRangeTool';
import { MaskingDetectorTool } from '../../../tools/audio/MaskingDetectorTool';
import { SpectrumAnalyzerTool } from '../../../tools/audio/SpectrumAnalyzerTool';
import { StereoImageTool } from '../../../tools/audio/StereoImageTool';

export class MixDiagnosticEngine {
  private audioAnalyzer = new AudioAnalyzerTool();
  private masking = new MaskingDetectorTool();
  private spectrum = new SpectrumAnalyzerTool();
  private stereo = new StereoImageTool();
  private dynamics = new DynamicRangeTool();

  analyze(input: Record<string, any>) {
    const query = String(input.query || input.notes || '');
    const audio = this.audioAnalyzer.run(input);
    const masking = this.masking.run({ query, notes: input.notes });
    const spectrum = this.spectrum.run({ query, notes: input.notes });
    const stereo = this.stereo.run(input);
    const dynamics = this.dynamics.run(input);

    const problems = [
      ...masking.masking,
      audio.peakDb > -1 ? 'Master is too close to clipping before final limiting.' : 'Master headroom looks workable for a first pass.',
      audio.integratedLufs > -8 ? 'Loudness is already aggressive; avoid crushing the master further.' : 'There is room to balance before final loudness.'
    ];

    return {
      audio,
      masking,
      spectrum,
      stereo,
      dynamics,
      problems,
      confidence: Math.min(audio.confidence + 0.1, 0.9)
    };
  }
}
