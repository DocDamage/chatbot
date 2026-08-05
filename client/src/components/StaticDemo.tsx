import './StaticDemo.css';

const unavailableFeatures = [
  'AI responses, authentication, conversations, memory, and provider access',
  'File browsing, document ingestion, Knowledge OS, and online research',
  'Local tools, Sprite Lab, FL Studio control, administration, and exports'
];

function StaticDemo() {
  return (
    <div className="app static-demo-app" data-static-demo="true">
      <header className="app-header static-demo-header">
        <div>
          <h1>AI Chatbot Hub</h1>
          <p className="subtitle">Static interface demonstration</p>
        </div>
        <span className="static-demo-badge">GitHub Pages demo</span>
      </header>

      <main className="static-demo-main">
        <section className="static-demo-notice" role="status" aria-live="polite">
          <strong>Static interface demo only</strong>
          <p>
            This GitHub Pages site has no application server, accounts, database, model provider,
            Redis, file access, or local-tool connection. It does not send prompts or run actions.
          </p>
        </section>

        <div className="static-demo-grid">
          <section className="static-demo-chat" aria-label="Chat interface preview">
            <div className="static-demo-toolbar" aria-label="Example mode selection">
              <span className="static-demo-mode static-demo-mode-active">Ask</span>
              <span className="static-demo-mode">Plan</span>
              <span className="static-demo-mode">Debug</span>
              <span className="static-demo-mode">Game Dev</span>
            </div>

            <div className="static-demo-thread" aria-label="Example conversation">
              <article className="static-demo-message static-demo-message-user">
                <span className="static-demo-speaker">Example user</span>
                <p>Plan a production-ready chatbot feature.</p>
              </article>
              <article className="static-demo-message static-demo-message-assistant">
                <span className="static-demo-speaker">Example response</span>
                <p>
                  The full application can provide planning, provider routing, persistence, and
                  specialist workflows after a server is installed and configured.
                </p>
              </article>
            </div>

            <div className="static-demo-composer" aria-label="Disabled chat composer">
              <label htmlFor="static-demo-input">Message</label>
              <textarea
                id="static-demo-input"
                disabled
                rows={2}
                placeholder="Messaging is unavailable in the static demo"
              />
              <button type="button" disabled>Send unavailable</button>
            </div>
          </section>

          <aside className="static-demo-limitations" aria-labelledby="static-demo-limitations-title">
            <h2 id="static-demo-limitations-title">Unavailable in this demo</h2>
            <ul>
              {unavailableFeatures.map(feature => <li key={feature}>{feature}</li>)}
            </ul>
            <p>
              The production deployment path remains a separately hosted application with its own
              API, security controls, persistence, monitoring, backup, and rollback verification.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default StaticDemo;
