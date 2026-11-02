import { prepareTrainingPlan } from '../../src/core/dabook/training/TrainingPlan';
const [bundle, model] = process.argv.slice(2);
if (!bundle || !model || process.argv.length !== 4)
  throw new Error(
    'Usage: tsx scripts/dabook/prepare-training.ts <governed-bundle-directory> <base-model>'
  );
console.log(JSON.stringify(prepareTrainingPlan(bundle, model), null, 2));
