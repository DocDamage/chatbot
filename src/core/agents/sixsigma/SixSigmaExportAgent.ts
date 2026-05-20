import { StatSoftwareExportTool, SixSigmaExportFormat } from '../../tools/sixsigma/StatSoftwareExportTool';

export class SixSigmaExportAgent {
  private exporter = new StatSoftwareExportTool();

  export(input: string) {
    return this.exporter.generate(this.detectFormat(input), this.detectAnalysis(input));
  }

  private detectFormat(input: string): SixSigmaExportFormat {
    const text = input.toLowerCase();
    if (text.includes('jupyter')) return 'jupyter_notebook';
    if (text.includes('python')) return 'python_script';
    if (text.includes('minitab')) return 'minitab_session';
    if (text.includes('spss')) return 'spss_syntax';
    if (text.includes('jmp')) return 'jmp_jsl';
    if (text.includes(' r ')) return 'r_script';
    return 'excel';
  }

  private detectAnalysis(input: string) {
    return input.toLowerCase().includes('control') ? 'control_chart' : 'cpk';
  }
}
