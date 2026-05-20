import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { BeamLoadTool } from '../../tools/engineering/BeamLoadTool';
import { BOMBuilderTool } from '../../tools/engineering/BOMBuilderTool';
import { CircuitChecklistTool } from '../../tools/engineering/CircuitChecklistTool';
import { MotorSizingTool } from '../../tools/engineering/MotorSizingTool';
import { OhmsLawTool } from '../../tools/engineering/OhmsLawTool';
import { RoboticsKinematicsTool } from '../../tools/engineering/RoboticsKinematicsTool';
import { UnitConversionTool } from '../../tools/engineering/UnitConversionTool';

const profile = {
  id: "engineering",
  label: "Engineering / Maker / Robotics Genius",
  guardrails: [
    "Prioritize physical safety.",
    "State assumptions and units.",
    "Recommend professional review for high-risk designs."
  ],
  workflows: [
    "Classify electronics, robotics, mechanical, CAD, BOM, or safety intent.",
    "Run deterministic calculators where possible.",
    "Return assumptions, calculations, parts, risks, and verification."
  ],
  tools: [
    "OhmsLawTool",
    "MotorSizingTool",
    "BeamLoadTool",
    "UnitConversionTool",
    "CircuitChecklistTool",
    "RoboticsKinematicsTool",
    "BOMBuilderTool"
  ],
  defaultSources: [
    "knowledge-base-public/engineering/overview.md"
  ]
};

export class EngineeringGeniusAgent extends GenericSpecialistAgent {
  private ohmsLawTool = new OhmsLawTool();
  private motorSizingTool = new MotorSizingTool();
  private beamLoadTool = new BeamLoadTool();
  private unitConversionTool = new UnitConversionTool();
  private circuitChecklistTool = new CircuitChecklistTool();
  private roboticsKinematicsTool = new RoboticsKinematicsTool();
  private bomBuilderTool = new BOMBuilderTool();

  constructor(documentStore?: any) {
    super(profile, documentStore);
  }

  override async ask(query: string, mode = 'ask') {
    const toolResponse = this.toolFirstResponse(query, mode);
    if (toolResponse) {
      return toolResponse;
    }

    return super.ask(query, mode);
  }

  electronics(query: string) {
    return this.ask(query, 'electronics');
  }

  robotics(query: string) {
    return this.ask(query, 'robotics');
  }

  mechanical(query: string) {
    return this.ask(query, 'mechanical');
  }

  bom(query: string) {
    return this.ask(query, 'bom');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const results: Array<Record<string, any>> = [];

    if (mode === 'bom' || /\b(bom|bill of materials|parts list|component list|prototype)\b/.test(text)) {
      results.push(this.bomBuilderTool.run({ query }));
      results.push(this.circuitChecklistTool.run({ query }));
    } else if (mode === 'electronics' || /\b(ohm|voltage|current|amp|resistor|circuit|battery|led|mosfet|power)\b/.test(text)) {
      results.push(this.ohmsLawTool.run({ query }));
      results.push(this.circuitChecklistTool.run({ query }));
      results.push(this.unitConversionTool.run({ query }));
    } else if (mode === 'robotics' || /\b(robot|robotics|rover|motor|wheel|rpm|kinematics|servo|stepper)\b/.test(text)) {
      results.push(this.motorSizingTool.run({ query }));
      results.push(this.roboticsKinematicsTool.run({ query }));
      results.push(this.circuitChecklistTool.run({ query }));
    } else if (mode === 'mechanical' || /\b(beam|load|span|bracket|mechanical|force|torque|structure)\b/.test(text)) {
      results.push(this.beamLoadTool.run({ query }));
      results.push(this.unitConversionTool.run({ query }));
    } else {
      return undefined;
    }

    return {
      domain: 'engineering',
      mode,
      response: [
        `Engineering / Maker / Robotics Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        'Engineering tool results:',
        ...results.map(result => `- ${result.tool}: ${JSON.stringify(result, null, 2)}`),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic engineering tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'engineering-tool')),
      model: 'engineering-tools'
    };
  }
}
