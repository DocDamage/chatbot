import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { FLStudioControlAgent } from '../../core/integrations/flstudio/FLStudioControlAgent';

export function createFLStudioControlRouter(services: any = {}): Router {
  const router = Router();
  const getAgent = () => services?.flStudioControlAgent || new FLStudioControlAgent();

  router.post('/api/flstudio/connect', asyncHandler(async (req, res) => {
    res.json(await getAgent().connect(req.body || {}));
  }));

  router.get('/api/flstudio/status', asyncHandler(async (_req, res) => {
    res.json(getAgent().status());
  }));

  router.get('/api/flstudio/tools', asyncHandler(async (_req, res) => {
    res.json(await getAgent().tools());
  }));

  router.get('/api/flstudio/state', asyncHandler(async (_req, res) => {
    res.json(getAgent().state());
  }));

  router.post('/api/flstudio/disconnect', asyncHandler(async (_req, res) => {
    res.json(getAgent().disconnect());
  }));

  router.post('/api/flstudio/command', asyncHandler(async (req, res) => {
    const query = req.body.query || req.body.message || req.body.command || '';
    res.json(await getAgent().command(query, {
      mode: req.body.mode,
      confirmed: req.body.confirmed === true
    }));
  }));

  router.post('/api/flstudio/tool-call', asyncHandler(async (req, res) => {
    const toolName = String(req.body.toolName || req.body.tool || '').trim();
    if (!toolName) {
      return res.status(400).json({ error: 'toolName is required' });
    }

    res.json(await getAgent().callTool(toolName, req.body.args || {}, {
      mode: req.body.mode,
      confirmed: req.body.confirmed === true
    }));
  }));

  router.post('/api/flstudio/piano-roll/notes', asyncHandler(async (req, res) => {
    res.json(await getAgent().executeActions([
      {
        tool: 'fl_send_notes',
        args: { notes: req.body.notes || [], channel: req.body.channel || 'selected' },
        description: 'Send explicit notes to the active Piano Roll.'
      }
    ], 'Send explicit Piano Roll notes.', { mode: req.body.mode, confirmed: req.body.confirmed === true }));
  }));

  router.post('/api/flstudio/piano-roll/chord', asyncHandler(async (req, res) => {
    res.json(await getAgent().executeActions([
      {
        tool: 'fl_send_chord',
        args: {
          notes: req.body.notes || [],
          time: req.body.time || 0,
          duration: req.body.duration || 2,
          velocity: req.body.velocity || 92
        },
        description: 'Send a chord to the active Piano Roll.'
      }
    ], 'Send explicit Piano Roll chord.', { mode: req.body.mode, confirmed: req.body.confirmed === true }));
  }));

  router.post('/api/flstudio/channel/step-sequence', asyncHandler(async (req, res) => {
    res.json(await getAgent().executeActions([
      {
        tool: 'fl_set_step_sequence',
        args: {
          channel: req.body.channel || 'selected',
          steps: req.body.steps || [],
          length: req.body.length || 16
        },
        description: 'Set a Channel Rack step sequence.'
      }
    ], 'Set Channel Rack step sequence.', { mode: req.body.mode, confirmed: req.body.confirmed === true }));
  }));

  router.post('/api/flstudio/mixer/set', asyncHandler(async (req, res) => {
    const actions = [];
    if (req.body.dbChange !== undefined || req.body.volume !== undefined) {
      actions.push({
        tool: 'fl_set_track_volume',
        args: { track: req.body.track || 1, dbChange: req.body.dbChange ?? req.body.volume },
        description: 'Set or adjust mixer track volume.'
      });
    }
    if (req.body.pan !== undefined) {
      actions.push({
        tool: 'fl_set_track_pan',
        args: { track: req.body.track || 1, pan: req.body.pan },
        description: 'Set mixer track pan.'
      });
    }
    if (req.body.mute !== undefined) {
      actions.push({
        tool: 'fl_mute_track',
        args: { track: req.body.track || 1, muted: req.body.mute },
        description: 'Mute or unmute a mixer track.'
      });
    }
    if (req.body.solo !== undefined) {
      actions.push({
        tool: 'fl_solo_track',
        args: { track: req.body.track || 1, solo: req.body.solo },
        description: 'Solo or unsolo a mixer track.'
      });
    }

    res.json(await getAgent().executeActions(actions, 'Set FL Studio mixer values.', { mode: req.body.mode, confirmed: req.body.confirmed === true }));
  }));

  router.post('/api/flstudio/transport', asyncHandler(async (req, res) => {
    const action = String(req.body.action || '').toLowerCase();
    const tool = action === 'record' ? 'fl_record' : action === 'stop' ? 'fl_stop' : 'fl_play';
    res.json(await getAgent().executeActions([
      { tool, args: {}, description: `Run FL Studio transport action: ${action || 'play'}.` }
    ], `FL Studio transport ${action || 'play'}.`, { mode: req.body.mode, confirmed: req.body.confirmed === true }));
  }));

  return router;
}

export const createFLStudioRouter = createFLStudioControlRouter;
