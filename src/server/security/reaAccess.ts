import { RequestHandler } from 'express';
import { isReaCommand } from '../../core/rea/ReaChat';
import { resolveDeploymentMode } from '../../core/config/EnvironmentDefinitions';
import { AuthorizationError } from '../../utils/errors';
import { sanitizeInput } from '../../middleware/validator';

/** Every chat API must apply the same boundary as the privileged REA router. */
export const requireReaChatAccess: RequestHandler = (req, _res, next) => {
  const message = typeof req.body?.message === 'string' ? sanitizeInput(req.body.message) : '';
  if (isReaCommand(message)
    && (resolveDeploymentMode() === 'hosted' || !req.user?.roles?.some(role => ['developer', 'admin'].includes(role)))) {
    return next(new AuthorizationError('REA requires a local developer session.'));
  }
  next();
};
