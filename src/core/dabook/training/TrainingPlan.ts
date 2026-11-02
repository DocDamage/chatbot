import fs from 'node:fs';
import path from 'node:path';
import { TrainingPlanOptions, verifyTrainingBundle } from './TrainingPlanVerifier';

export { artifactHash, TrainingPlanOptions, verifyPreparedTrainingPlan } from './TrainingPlanVerifier';

/** Prepare an explicit local trainer handoff; never starts training or activates a model. */
export function prepareTrainingPlan(
  bundleDirectory: string,
  baseModel: string,
  options: TrainingPlanOptions = {}
) {
  if (!baseModel.trim() || baseModel.length > 300) throw new Error('Specify a base model.');
  const verified = verifyTrainingBundle(bundleDirectory, options);
  const planRoot = path.join(verified.root, 'training-plan');
  if (fs.existsSync(planRoot)) throw new Error('A training plan already exists for this bundle.');
  const files: Record<string, string> = {};
  for (const [split, evidence] of Object.entries(verified.splits))
    files[split] = path.join(verified.root, evidence.preparedRelative).replace(/\\/g, '/');
  const dataset = (file: string) => ({
    path: file,
    type: 'chat_template',
    field_messages: 'messages',
  });
  const config = {
    base_model: baseModel,
    adapter: 'lora',
    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.05,
    lora_target_linear: true,
    load_in_4bit: true,
    chat_template: 'tokenizer_default',
    datasets: [dataset(files.train)],
    ...(files.val ? { test_datasets: [dataset(files.val)] } : {}),
    val_set_size: 0,
    output_dir: path.join(verified.root, 'trained-adapter').replace(/\\/g, '/'),
    sequence_len: 2048,
    micro_batch_size: 1,
    gradient_accumulation_steps: 4,
    num_epochs: 1,
    learning_rate: 0.0002,
    optimizer: 'adamw_torch',
    bf16: 'auto',
  };
  const configPath = path.join(planRoot, 'axolotl.json');
  const staging = fs.mkdtempSync(path.join(verified.root, '.training-plan-'));
  try {
    for (const evidence of Object.values(verified.splits))
      fs.writeFileSync(path.join(staging, `${evidence.split}.jsonl`), evidence.content);
    fs.writeFileSync(path.join(staging, 'axolotl.json'), JSON.stringify(config, null, 2));
    fs.renameSync(staging, planRoot);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return {
    status: 'prepared',
    configPath,
    heldOutTest: files.test,
    trainingStarted: false,
    nextSteps: [
      'Review GPU capacity and base-model license.',
      'Run axolotl preprocess axolotl.json, then axolotl train axolotl.json in a configured trainer environment.',
      'Evaluate the trained artifact on the held-out test split before registering or activating it.',
    ],
  };
}
