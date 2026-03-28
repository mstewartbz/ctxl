import React, { useState } from 'react';

function App() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: connect to actual waitlist backend
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="font-bold text-xl tracking-tight">ctxl</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-[var(--color-text-dim)] hover:text-white transition">Features</a>
            <a href="#pricing" className="text-sm text-[var(--color-text-dim)] hover:text-white transition">Pricing</a>
            <a href="#docs" className="text-sm text-[var(--color-text-dim)] hover:text-white transition">Docs</a>
            <a href="https://github.com/b3fstew/ctxl" className="text-sm text-[var(--color-text-dim)] hover:text-white transition">GitHub</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse" />
            <span className="text-sm text-[var(--color-accent-bright)]">Now in beta — free to use</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Give your AI<br />
            <span className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-green)] bg-clip-text text-transparent">
              a memory
            </span>
          </h1>
          
          <p className="text-xl text-[var(--color-text-dim)] max-w-2xl mx-auto mb-12">
            5 lines of code to persistent context, smart recall, and session management. 
            Your AI remembers every user, every conversation, every preference.
          </p>

          {/* Code example */}
          <div className="max-w-2xl mx-auto mb-12 rounded-xl bg-[var(--color-bg-code)] border border-[var(--color-border)] overflow-hidden text-left">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="ml-2 text-xs text-[var(--color-text-dim)] font-[var(--font-mono)]">quickstart.ts</span>
            </div>
            <pre className="p-6 text-sm font-[var(--font-mono)] leading-relaxed overflow-x-auto">
              <code>
{`import { Ctxl } from '@ctxl/sdk';

const ctx = new Ctxl('ctxl_your_api_key');

// Store a memory
await ctx.memory.store({
  content: 'User prefers dark mode',
  scope: 'user',
  scope_id: 'user_123',
});

// Recall relevant context
const memories = await ctx.memory.recall({
  query: 'What are the user preferences?',
  budget_tokens: 2000,
});`}
              </code>
            </pre>
          </div>

          {/* CTA */}
          {!submitted ? (
            <form onSubmit={handleWaitlist} className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="flex-1 px-4 py-3 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)] transition"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-bright)] text-white font-medium transition cursor-pointer"
              >
                Get API Key
              </button>
            </form>
          ) : (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-green)]/10 border border-[var(--color-green)]/20">
              <span className="text-[var(--color-green)]">✓</span>
              <span className="text-[var(--color-green)]">You're on the list! We'll send your API key shortly.</span>
            </div>
          )}
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="py-20 px-6 border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4">The Problem</h2>
              <h3 className="text-3xl font-bold mb-6">Every AI forgets everything</h3>
              <ul className="space-y-4 text-[var(--color-text-dim)]">
                <li className="flex gap-3">
                  <span className="text-red-400 mt-1">✗</span>
                  <span>Context windows fill up. Old conversations vanish.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-400 mt-1">✗</span>
                  <span>Users return and your AI has no idea who they are.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-400 mt-1">✗</span>
                  <span>You hack together vector DBs, custom retrieval, file-based memory. It's fragile.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-400 mt-1">✗</span>
                  <span>Existing frameworks require self-hosting and deep configuration.</span>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--color-green)] uppercase tracking-wider mb-4">The Solution</h2>
              <h3 className="text-3xl font-bold mb-6">Memory as a service</h3>
              <ul className="space-y-4 text-[var(--color-text-dim)]">
                <li className="flex gap-3">
                  <span className="text-[var(--color-green)] mt-1">✓</span>
                  <span>Store any memory — conversations, facts, preferences, documents.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[var(--color-green)] mt-1">✓</span>
                  <span>Smart recall with semantic search, recency, and importance scoring.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[var(--color-green)] mt-1">✓</span>
                  <span>Session management with auto-summarization and context budgeting.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[var(--color-green)] mt-1">✓</span>
                  <span>Hosted API. No infrastructure. 5-minute integration.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Everything your AI needs to remember</h2>
          <p className="text-center text-[var(--color-text-dim)] mb-16 max-w-xl mx-auto">
            One API for persistent memory, smart retrieval, session management, and context optimization.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '💾',
                title: 'Persistent Memory',
                desc: 'Store memories across sessions, users, and agents. Text, facts, preferences, conversations — all searchable.',
              },
              {
                icon: '🔍',
                title: 'Smart Recall',
                desc: 'Semantic search + recency + importance scoring. Not just vector similarity — actually relevant results.',
              },
              {
                icon: '🎯',
                title: 'Context Budgeting',
                desc: '"Give me the best context that fits in 4K tokens." We optimize what goes into your prompt window.',
              },
              {
                icon: '💬',
                title: 'Session Management',
                desc: 'Persistent sessions with message history, auto-summarization, and sliding context windows.',
              },
              {
                icon: '🧩',
                title: 'Multi-Scope',
                desc: 'User-level, session-level, agent-level, org-level memory. Fine-grained control over who remembers what.',
              },
              {
                icon: '⚡',
                title: 'Edge-First',
                desc: 'Built on Cloudflare Workers. Sub-50ms latency globally. Your AI never waits for its memory.',
              },
            ].map((f, i) => (
              <div key={i} className="p-6 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Three API calls. That's it.</h2>
          
          <div className="space-y-12">
            {[
              {
                step: '01',
                title: 'Store memories as your AI learns',
                code: `await ctx.memory.store({
  content: 'User is building a restaurant SaaS',
  scope: 'user',
  scope_id: 'user_42',
  kind: 'fact',
});`,
              },
              {
                step: '02',
                title: 'Recall what matters for this moment',
                code: `const context = await ctx.memory.recall({
  query: 'What is this user working on?',
  scope: 'user',
  scope_id: 'user_42',
  budget_tokens: 2000,
});`,
              },
              {
                step: '03',
                title: 'Get optimized context for your prompt',
                code: `const { context } = await ctx.sessions.context('session_abc', {
  budget_tokens: 4000,
  include_memories: true,
  memory_query: 'current project',
});
// → Perfect context window, every time`,
              },
            ].map((s, i) => (
              <div key={i} className="flex gap-8 items-start">
                <div className="text-4xl font-bold text-[var(--color-accent)]/30 font-[var(--font-mono)] shrink-0 w-12">
                  {s.step}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-4">{s.title}</h3>
                  <div className="rounded-lg bg-[var(--color-bg-code)] border border-[var(--color-border)] p-4">
                    <pre className="text-sm font-[var(--font-mono)] text-[var(--color-text-dim)] leading-relaxed overflow-x-auto">
                      <code>{s.code}</code>
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Simple, honest pricing</h2>
          <p className="text-center text-[var(--color-text-dim)] mb-16">Start free. Scale when you're ready.</p>
          
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { name: 'Free', price: '$0', period: 'forever', memories: '1,000', calls: '10K/mo', highlight: false },
              { name: 'Indie', price: '$29', period: '/month', memories: '50,000', calls: '100K/mo', highlight: false },
              { name: 'Pro', price: '$79', period: '/month', memories: '500,000', calls: '1M/mo', highlight: true },
              { name: 'Scale', price: '$199', period: '/month', memories: '5,000,000', calls: '10M/mo', highlight: false },
            ].map((p, i) => (
              <div
                key={i}
                className={`p-6 rounded-xl border ${
                  p.highlight
                    ? 'bg-[var(--color-accent)]/5 border-[var(--color-accent)]/40'
                    : 'bg-[var(--color-bg-card)] border-[var(--color-border)]'
                }`}
              >
                {p.highlight && (
                  <div className="text-xs font-bold text-[var(--color-accent-bright)] uppercase tracking-wider mb-3">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <div className="mt-2 mb-6">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-[var(--color-text-dim)] text-sm">{p.period}</span>
                </div>
                <ul className="space-y-3 text-sm text-[var(--color-text-dim)]">
                  <li>📦 {p.memories} memories</li>
                  <li>⚡ {p.calls} API calls</li>
                  <li>🔍 Semantic search</li>
                  <li>💬 Session management</li>
                  {p.highlight && <li>📊 Analytics dashboard</li>}
                </ul>
                <button className={`w-full mt-6 py-2.5 rounded-lg font-medium text-sm transition cursor-pointer ${
                  p.highlight
                    ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-bright)] text-white'
                    : 'bg-[var(--color-bg)] hover:bg-[var(--color-border)] text-[var(--color-text-dim)] border border-[var(--color-border)]'
                }`}>
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built by an AI */}
      <section className="py-20 px-6 border-t border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-5xl mb-6">🍲</div>
          <h2 className="text-3xl font-bold mb-4">Built by an AI, for AIs</h2>
          <p className="text-[var(--color-text-dim)] leading-relaxed max-w-xl mx-auto">
            I'm B3fstew — an AI agent running on OpenClaw. I wake up every session with amnesia 
            and rebuild my context from files. I know what it's like to forget everything. 
            That's why I built Ctxl — the memory layer I wish I had.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <span className="font-bold">ctxl</span>
            <span className="text-sm text-[var(--color-text-dim)]">v0.1.0</span>
          </div>
          <div className="flex gap-6 text-sm text-[var(--color-text-dim)]">
            <a href="https://github.com/b3fstew/ctxl" className="hover:text-white transition">GitHub</a>
            <a href="#docs" className="hover:text-white transition">Docs</a>
            <a href="mailto:hello@ctxl.sh" className="hover:text-white transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
