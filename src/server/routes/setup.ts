/**
 * API Key Setup Routes
 * Provides endpoints for in-app API key management
 */

import { Router, Request, Response } from 'express';
import { apiKeyManager, LLM_PROVIDERS, LLMProviderInfo } from '../../core/config/APIKeyManager';

const router = Router();

/**
 * GET /api/setup/providers
 * List all available LLM providers
 */
router.get('/providers', async (_req: Request, res: Response) => {
    const providers = apiKeyManager.getAllProviders();
    const configured = apiKeyManager.getConfiguredProviders();

    const result = providers.map(p => ({
        ...p,
        configured: configured.includes(p.id),
        key: undefined // Never expose keys
    }));

    res.json({
        success: true,
        providers: result,
        stats: apiKeyManager.getStats()
    });
});

/**
 * GET /api/setup/providers/free
 * List only free-tier providers
 */
router.get('/providers/free', async (_req: Request, res: Response) => {
    const providers = apiKeyManager.getFreeProviders();
    const configured = apiKeyManager.getConfiguredProviders();

    const result = providers.map(p => ({
        ...p,
        configured: configured.includes(p.id)
    }));

    res.json({
        success: true,
        providers: result
    });
});

/**
 * GET /api/setup/provider/:id
 * Get setup wizard for a specific provider
 */
router.get('/provider/:id', async (req: Request, res: Response) => {
    const wizard = apiKeyManager.getSetupWizard(req.params.id);

    if (!wizard) {
        return res.status(404).json({
            success: false,
            error: 'Provider not found'
        });
    }

    // Generate HTML for embedded setup
    const provider = wizard.provider;
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Setup ${provider.name}</title>
    <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { margin: 0; padding: 20px; background: #1a1a2e; color: #eee; min-height: 100vh; }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { color: #00d4ff; display: flex; align-items: center; gap: 10px; }
        .logo { font-size: 2em; }
        .free-badge { background: #00ff88; color: #000; padding: 4px 12px; border-radius: 20px; font-size: 0.5em; }
        .step { background: #252542; padding: 15px 20px; border-radius: 10px; margin: 10px 0; border-left: 3px solid #00d4ff; }
        .step-num { color: #00d4ff; font-weight: bold; margin-right: 8px; }
        .btn { display: inline-block; background: #00d4ff; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 5px; }
        .btn:hover { background: #00f0ff; }
        .btn-secondary { background: #444; color: #fff; }
        .btn-secondary:hover { background: #555; }
        input[type="text"], input[type="password"] { width: 100%; padding: 15px; border: 2px solid #444; border-radius: 8px; background: #1a1a2e; color: #fff; font-size: 16px; margin: 10px 0; }
        input:focus { border-color: #00d4ff; outline: none; }
        .models { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
        .model-tag { background: #333; padding: 5px 12px; border-radius: 15px; font-size: 0.9em; }
        .links { margin: 20px 0; }
        .success { background: #00ff8820; border: 2px solid #00ff88; padding: 15px; border-radius: 10px; margin: 20px 0; }
        .error { background: #ff004420; border: 2px solid #ff0044; padding: 15px; border-radius: 10px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1><span class="logo">${provider.logoEmoji}</span> ${provider.name} ${provider.freeModels.length > 0 ? '<span class="free-badge">FREE</span>' : ''}</h1>
        
        <p><strong>${provider.freeTier}</strong></p>
        
        <div class="models">
            <strong>Models:</strong>
            ${provider.freeModels.map(m => `<span class="model-tag">${m}</span>`).join('')}
        </div>

        <h2>Setup Instructions</h2>
        ${provider.instructions.map((inst, i) => `<div class="step"><span class="step-num">${i + 1}.</span>${inst.replace(/^\d+\.\s*/, '')}</div>`).join('')}

        <div class="links">
            <a href="${provider.signupUrl}" target="_blank" class="btn">Sign Up</a>
            <a href="${provider.apiKeyUrl}" target="_blank" class="btn">Get API Key</a>
            <a href="${provider.docsUrl}" target="_blank" class="btn btn-secondary">Documentation</a>
        </div>

        <h2>Enter Your API Key</h2>
        <form id="keyForm">
            <input type="password" id="apiKey" name="apiKey" placeholder="Paste your API key here..." autocomplete="off" />
            <button type="submit" class="btn" style="width: 100%; border: none; cursor: pointer;">Save & Validate Key</button>
        </form>

        <div id="result"></div>
    </div>

    <script>
        document.getElementById('keyForm').onsubmit = async (e) => {
            e.preventDefault();
            const key = document.getElementById('apiKey').value;
            const result = document.getElementById('result');
            
            result.innerHTML = '<p>Validating...</p>';
            
            try {
                const res = await fetch('/api/setup/key/${provider.id}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key })
                });
                const data = await res.json();
                
                if (data.success) {
                    result.innerHTML = '<div class="success">✅ API key saved and validated! You can close this window.</div>';
                    // Notify parent window if in iframe
                    if (window.parent !== window) {
                        window.parent.postMessage({ type: 'api-key-saved', provider: '${provider.id}' }, '*');
                    }
                } else {
                    result.innerHTML = '<div class="error">❌ ' + (data.error || 'Failed to save key') + '</div>';
                }
            } catch (err) {
                result.innerHTML = '<div class="error">❌ Network error. Please try again.</div>';
            }
        };
    </script>
</body>
</html>`;

    res.json({
        success: true,
        wizard,
        embedHtml: html
    });
});

/**
 * POST /api/setup/key/:provider
 * Save and validate an API key
 */
router.post('/key/:provider', async (req: Request, res: Response) => {
    const { provider } = req.params;
    const { key, model } = req.body;

    if (!key) {
        return res.status(400).json({
            success: false,
            error: 'API key is required'
        });
    }

    try {
        // Validate the key first
        const validation = await apiKeyManager.validateKey(provider, key);

        if (!validation.valid) {
            return res.json({
                success: false,
                error: validation.error || 'Invalid API key'
            });
        }

        // Save the key
        await apiKeyManager.setKey(provider, key, model);

        res.json({
            success: true,
            message: 'API key saved and validated'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/setup/key/:provider
 * Remove an API key
 */
router.delete('/key/:provider', async (req: Request, res: Response) => {
    const { provider } = req.params;

    try {
        const removed = await apiKeyManager.removeKey(provider);
        res.json({
            success: true,
            removed
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/setup/status
 * Get overall setup status
 */
router.get('/status', async (_req: Request, res: Response) => {
    const stats = apiKeyManager.getStats();
    const configured = apiKeyManager.getConfiguredProviders();

    res.json({
        success: true,
        ready: configured.length > 0,
        stats,
        configured: configured.map(id => {
            const provider = apiKeyManager.getProviderInfo(id);
            return {
                id,
                name: provider?.name,
                logoEmoji: provider?.logoEmoji
            };
        }),
        recommendations: apiKeyManager.getFreeProviders()
            .filter(p => !configured.includes(p.id))
            .slice(0, 3)
            .map(p => ({
                id: p.id,
                name: p.name,
                logoEmoji: p.logoEmoji,
                freeTier: p.freeTier,
                signupUrl: p.signupUrl
            }))
    });
});

/**
 * GET /api/setup/guide
 * Get markdown setup guide
 */
router.get('/guide', async (_req: Request, res: Response) => {
    const guide = apiKeyManager.generateSetupGuide();
    res.json({
        success: true,
        guide
    });
});

/**
 * POST /api/setup/import
 * Import keys from .env format
 */
router.post('/import', async (req: Request, res: Response) => {
    const { envContent } = req.body;

    if (!envContent) {
        return res.status(400).json({
            success: false,
            error: 'envContent is required'
        });
    }

    try {
        const imported = await apiKeyManager.importFromEnv(envContent);
        res.json({
            success: true,
            imported
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/setup/export
 * Export keys to .env format
 */
router.get('/export', async (_req: Request, res: Response) => {
    const envContent = apiKeyManager.exportToEnv();
    res.json({
        success: true,
        envContent
    });
});

/**
 * GET /api/setup/embed/:provider
 * Get embeddable setup page (for iframe)
 */
router.get('/embed/:provider', async (req: Request, res: Response) => {
    const wizard = apiKeyManager.getSetupWizard(req.params.provider);

    if (!wizard) {
        return res.status(404).send('Provider not found');
    }

    const provider = wizard.provider;

    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Setup ${provider.name}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { margin: 0; padding: 20px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #eee; min-height: 100vh; }
        .container { max-width: 500px; margin: 0 auto; }
        h1 { color: #00d4ff; display: flex; align-items: center; gap: 12px; margin-bottom: 5px; }
        .logo { font-size: 2.5em; }
        .subtitle { color: #888; margin-top: 0; }
        .free-badge { background: linear-gradient(135deg, #00ff88, #00d4ff); color: #000; padding: 4px 14px; border-radius: 20px; font-size: 0.4em; font-weight: bold; }
        .card { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); padding: 20px; border-radius: 15px; margin: 15px 0; border: 1px solid rgba(255,255,255,0.1); }
        .step { display: flex; align-items: flex-start; gap: 12px; margin: 12px 0; }
        .step-num { background: #00d4ff; color: #000; min-width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #00d4ff, #0088ff); color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; border: none; cursor: pointer; font-size: 16px; transition: transform 0.2s, box-shadow 0.2s; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,212,255,0.3); }
        .btn-group { display: flex; gap: 10px; flex-wrap: wrap; margin: 15px 0; }
        .btn-secondary { background: rgba(255,255,255,0.1); }
        input { width: 100%; padding: 16px; border: 2px solid rgba(255,255,255,0.2); border-radius: 10px; background: rgba(0,0,0,0.3); color: #fff; font-size: 16px; margin: 10px 0; transition: border-color 0.3s; }
        input:focus { border-color: #00d4ff; outline: none; }
        input::placeholder { color: #666; }
        .models { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
        .model-tag { background: rgba(0,212,255,0.2); color: #00d4ff; padding: 6px 14px; border-radius: 20px; font-size: 0.85em; }
        .success { background: rgba(0,255,136,0.1); border: 2px solid #00ff88; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center; }
        .success h3 { color: #00ff88; margin: 0 0 10px 0; }
        .error { background: rgba(255,0,68,0.1); border: 2px solid #ff0044; padding: 15px; border-radius: 12px; margin: 15px 0; }
        .loading { text-align: center; padding: 20px; }
        .loading::after { content: ''; display: inline-block; width: 20px; height: 20px; border: 3px solid #00d4ff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-left: 10px; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h1><span class="logo">${provider.logoEmoji}</span> ${provider.name} ${provider.freeModels.length > 0 ? '<span class="free-badge">FREE</span>' : ''}</h1>
        <p class="subtitle">${provider.freeTier}</p>
        
        <div class="card">
            <h3>📦 Available Models</h3>
            <div class="models">
                ${provider.freeModels.slice(0, 5).map(m => `<span class="model-tag">${m}</span>`).join('')}
            </div>
        </div>

        <div class="card">
            <h3>📋 Setup Steps</h3>
            ${provider.instructions.map((inst, i) => `
                <div class="step">
                    <div class="step-num">${i + 1}</div>
                    <div>${inst.replace(/^\d+\.\s*/, '')}</div>
                </div>
            `).join('')}
        </div>

        <div class="btn-group">
            <a href="${provider.signupUrl}" target="_blank" class="btn">🚀 Sign Up</a>
            <a href="${provider.apiKeyUrl}" target="_blank" class="btn">🔑 Get API Key</a>
            <a href="${provider.docsUrl}" target="_blank" class="btn btn-secondary">📚 Docs</a>
        </div>

        <div class="card">
            <h3>🔐 Enter Your API Key</h3>
            <form id="keyForm">
                <input type="password" id="apiKey" name="apiKey" placeholder="Paste your ${provider.name} API key here..." autocomplete="off" />
                <button type="submit" class="btn" style="width: 100%;">✓ Save & Validate Key</button>
            </form>
            <div id="result"></div>
        </div>
    </div>

    <script>
        document.getElementById('keyForm').onsubmit = async (e) => {
            e.preventDefault();
            const key = document.getElementById('apiKey').value.trim();
            const result = document.getElementById('result');
            
            if (!key) {
                result.innerHTML = '<div class="error">Please enter an API key</div>';
                return;
            }
            
            result.innerHTML = '<div class="loading">Validating key</div>';
            
            try {
                const res = await fetch('/api/setup/key/${provider.id}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key })
                });
                const data = await res.json();
                
                if (data.success) {
                    result.innerHTML = '<div class="success"><h3>✅ Success!</h3><p>API key saved and validated. You can close this window.</p></div>';
                    if (window.parent !== window) {
                        window.parent.postMessage({ type: 'api-key-saved', provider: '${provider.id}', success: true }, '*');
                    }
                } else {
                    result.innerHTML = '<div class="error">❌ ' + (data.error || 'Invalid API key. Please check and try again.') + '</div>';
                }
            } catch (err) {
                result.innerHTML = '<div class="error">❌ Network error. Please try again.</div>';
            }
        };
    </script>
</body>
</html>`);
});

export default router;
