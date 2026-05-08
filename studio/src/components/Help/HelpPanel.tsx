import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { NODE_CATALOG, NODE_CATEGORIES, CATEGORY_NODES, PORT_COLORS, type NodeCategory } from '../../nodes/catalog';

type TabId = 'quickstart' | 'building' | 'nodes' | 'examples' | 'deploy' | 'troubleshooting';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'quickstart', label: 'Quickstart', icon: '🚀' },
  { id: 'building', label: 'Building Workflows', icon: '🧩' },
  { id: 'nodes', label: 'Node Reference', icon: '📚' },
  { id: 'examples', label: 'Examples', icon: '💡' },
  { id: 'deploy', label: 'Deploy', icon: '☁️' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '🛟' },
];

interface Props {
  onClose: () => void;
}

export function HelpPanel({ onClose }: Props) {
  const [tab, setTab] = useState<TabId>('quickstart');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-950">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <div>
              <h2 className="text-white font-semibold text-lg leading-tight">Agents Studio Help</h2>
              <p className="text-xs text-gray-400">Visual designer for AgentCore-native generative AI agents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none px-2"
            aria-label="Close help"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-56 flex-shrink-0 bg-gray-950 border-r border-gray-800 py-3 overflow-y-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                  tab === t.id
                    ? 'bg-blue-600/20 text-blue-300 border-l-2 border-blue-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-l-2 border-transparent'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}

            <div className="mt-6 px-4 py-3 text-xs text-gray-500 border-t border-gray-800">
              <div className="font-semibold text-gray-400 mb-1">Shortcuts</div>
              <div className="flex justify-between"><span>Validate</span><kbd className="bg-gray-800 px-1.5 rounded">⌘/Ctrl+S</kbd></div>
              <div className="flex justify-between"><span>Help</span><kbd className="bg-gray-800 px-1.5 rounded">?</kbd></div>
              <div className="flex justify-between"><span>Close</span><kbd className="bg-gray-800 px-1.5 rounded">Esc</kbd></div>
            </div>
          </nav>

          <main className="flex-1 overflow-y-auto px-8 py-6 text-gray-200">
            {tab === 'quickstart' && <Quickstart />}
            {tab === 'building' && <Building />}
            {tab === 'nodes' && <NodesReference />}
            {tab === 'examples' && <Examples />}
            {tab === 'deploy' && <Deploy />}
            {tab === 'troubleshooting' && <Troubleshooting />}
          </main>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Section components
// ────────────────────────────────────────────────────────────────────────────

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-bold text-white mb-4">{children}</h1>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-blue-300 mt-6 mb-2">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-300 leading-relaxed mb-3">{children}</p>;
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-800 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono">
      {children}
    </code>
  );
}
function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto mb-3">
      {children}
    </pre>
  );
}
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2 mb-3 list-none pl-0">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {i + 1}
          </span>
          <div className="text-sm text-gray-300 pt-0.5">{item}</div>
        </li>
      ))}
    </ol>
  );
}
function Callout({ kind, children }: { kind: 'tip' | 'warn' | 'info'; children: React.ReactNode }) {
  const map = {
    tip: { cls: 'border-green-700 bg-green-900/20 text-green-200', icon: '💡' },
    warn: { cls: 'border-amber-700 bg-amber-900/20 text-amber-200', icon: '⚠️' },
    info: { cls: 'border-blue-700 bg-blue-900/20 text-blue-200', icon: 'ℹ️' },
  };
  const { cls, icon } = map[kind];
  return (
    <div className={`border-l-4 rounded px-3 py-2 mb-3 text-sm flex gap-2 ${cls}`}>
      <span>{icon}</span>
      <div>{children}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function Quickstart() {
  return (
    <>
      <H1>🚀 Quickstart</H1>
      <P>
        Agents Studio is a drag-and-drop canvas for designing generative AI agents that compile to a
        deployable ZIP (Python + Terraform + Docker). The runtime target is{' '}
        <strong>Amazon Bedrock AgentCore</strong> — agents host on AgentCore Runtime, persist via
        AgentCore Memory, and observe via CloudWatch GenAI Observability.
      </P>

      <H2>UI layout</H2>
      <ul className="text-sm text-gray-300 space-y-1 mb-3 list-disc pl-5">
        <li><strong>Top bar</strong> — project name, Import ZIP, Validate, Generate ZIP, Help.</li>
        <li><strong>Left panel</strong> — node catalog grouped by category. Drag onto canvas.</li>
        <li><strong>Center</strong> — canvas. Pan with right-drag, zoom with scroll. Click node to select.</li>
        <li><strong>Right panel</strong> — config form for the selected node.</li>
      </ul>

      <H2>Round-trip: edit a generated agent</H2>
      <P>
        Every Generate ZIP run embeds a <Code>project.json</Code> in the bundle. Click{' '}
        <strong>Import ZIP</strong> to reload it: nodes, edges, configs, and project name are
        restored exactly. Make changes, then Generate ZIP again to produce an updated bundle.
      </P>
      <Callout kind="warn">
        Importing replaces the current canvas. The Studio prompts for confirmation when the canvas
        is non-empty.
      </Callout>

      <H2>Git integration (GitHub / GitLab)</H2>
      <P>
        Click <strong>🔀 Git</strong> in the toolbar to push the full generated repo (Python,
        Terraform, tests, Docker, <Code>project.json</Code>) to a GitHub or GitLab repo, or pull
        a previously pushed <Code>project.json</Code> back into the canvas.
      </P>
      <Steps
        items={[
          <>
            Create a Personal Access Token. <strong>GitHub:</strong> Settings → Developer settings →
            Tokens (fine-grained) → scopes <Code>Contents: read &amp; write</Code> on the target repo.{' '}
            <strong>GitLab:</strong> User settings → Access Tokens → scope <Code>api</Code>.
          </>,
          <>Open the Git modal, pick GitHub or GitLab, paste the token, and enter the repo (<Code>owner/name</Code> or <Code>group/project</Code>).</>,
          <><strong>Push</strong> tab → set branch + commit message → click Push. Engine validates the graph, runs the full pipeline, and atomically commits every generated file.</>,
          <><strong>Pull</strong> tab → set ref (branch/tag/SHA) and path (defaults to <Code>project.json</Code>) → click Pull. Canvas is replaced with the loaded graph.</>,
        ]}
      />
      <Callout kind="info">
        Tokens are stored only in browser <Code>localStorage</Code> and forwarded to the engine
        once per request. The engine never persists them. Use HTTPS for the engine endpoint
        when deploying publicly.
      </Callout>

      <H2>Build your first graph in 5 steps</H2>
      <Steps
        items={[
          <>Set a project name in the top bar (e.g. <Code>my-agent</Code>).</>,
          <>Drag <Code>Input</Code>, <Code>Agent</Code>, and <Code>Output</Code> from the left panel onto the canvas.</>,
          <>Click each node and fill required fields in the right panel (red badges = missing).</>,
          <>Drag from one node's <em>output port</em> (right side) to another's <em>input port</em> (left side). Port colors must match (or one must be <Code>any</Code>).</>,
          <>Click <strong>Validate</strong>. Green ✓ means ready. Click <strong>Generate ZIP</strong> to download.</>,
        ]}
      />

      <Callout kind="tip">
        Hover any node card in the left panel to see its description. Click a node on the canvas, then
        click <Code>?</Code> on the config panel to see compatible upstream/downstream ports.
      </Callout>
    </>
  );
}

function Building() {
  return (
    <>
      <H1>🧩 Building Workflows</H1>

      <H2>Graph rules</H2>
      <ul className="text-sm text-gray-300 space-y-1 mb-3 list-disc pl-5">
        <li>Every graph needs at least one <Code>input</Code> and one <Code>output</Code> node.</li>
        <li>Graph must be acyclic (no loops back to earlier nodes — use the <Code>loop</Code> node for fan-out).</li>
        <li>Edges flow from output ports → input ports. Source and target data types must match (or one is <Code>any</Code>).</li>
        <li>Each tool node compiles to its own Lambda with a least-privilege IAM role.</li>
      </ul>

      <H2>Port types</H2>
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(PORT_COLORS).map(([t, dot]) => (
          <span key={t} className="inline-flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {t}
          </span>
        ))}
      </div>
      <P>
        <Code>any</Code> ports accept anything. Mismatched types show a red edge — change a port to{' '}
        <Code>any</Code> in the node config or insert a transform node.
      </P>

      <H2>Connecting nodes</H2>
      <Steps
        items={[
          <>Hover a node — its ports light up (right side = outputs, left side = inputs).</>,
          <>Click and drag from an output handle to an input handle on another node.</>,
          <>Drop on a compatible port. Incompatible drops are rejected silently.</>,
          <>To delete an edge, click it then press <Code>Delete</Code> / <Code>Backspace</Code>.</>,
        ]}
      />

      <H2>Validation</H2>
      <P>
        Click <strong>Validate</strong> to call the engine's <Code>/validate</Code> endpoint.
        Errors appear as red badges on the offending nodes with field-level messages. Common codes:
      </P>
      <ul className="text-sm text-gray-300 space-y-1 mb-3 list-disc pl-5">
        <li><Code>MISSING_REQUIRED_FIELD</Code> — fill the required config field on that node.</li>
        <li><Code>TYPE_MISMATCH</Code> — incompatible edge; change port type or insert transform.</li>
        <li><Code>CYCLE_DETECTED</Code> — remove the back-edge or use a <Code>loop</Code> node.</li>
        <li><Code>UNSAFE_QUERY_TEMPLATE</Code> — Athena query uses string interpolation; switch to <Code>?</Code> placeholders.</li>
      </ul>

      <H2>Generate ZIP</H2>
      <P>
        Click <strong>Generate ZIP</strong>. The engine compiles your graph into seven phases:
        validate → graph compile → IaC → tests → local scaffold → observability → bundle. The
        download contains <Code>agent/</Code>, <Code>infra/</Code>, <Code>tests/</Code>,{' '}
        <Code>local/</Code>, <Code>Dockerfile</Code>, <Code>pyproject.toml</Code>, and{' '}
        <Code>project.json</Code> (re-import schema).
      </P>
    </>
  );
}

function NodesReference() {
  return (
    <>
      <H1>📚 Node Reference</H1>
      <P>
        All node types available in the catalog, grouped by category. Click a node on the canvas and
        open its inline help (<Code>?</Code> in the config panel) to see ports and compatible edges.
      </P>

      {NODE_CATEGORIES.map((cat: NodeCategory) => (
        <div key={cat} className="mb-5">
          <H2>{cat}</H2>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_NODES[cat].map((t) => {
              const def = NODE_CATALOG[t];
              return (
                <div
                  key={t}
                  className="border border-gray-800 rounded-lg p-3 bg-gray-950 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{def.icon}</span>
                    <span className="text-sm font-semibold text-white">{def.label}</span>
                    <span className="text-xs text-gray-500 font-mono ml-auto">{def.type}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">{def.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function Examples() {
  return (
    <>
      <H1>💡 Examples</H1>

      <H2>RAG agent: API Gateway → AgentCore Runtime → S3 Vectors + Memory</H2>
      <P>Conversational RAG agent backed by an S3 Vectors knowledge base and AgentCore Memory.</P>

      <div className="overflow-x-auto mb-3">
        <table className="text-xs w-full border border-gray-800">
          <thead className="bg-gray-950 text-gray-400">
            <tr>
              <th className="px-2 py-1 text-left">Node</th>
              <th className="px-2 py-1 text-left">Category</th>
              <th className="px-2 py-1 text-left">Required config</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-t border-gray-800">
              <td className="px-2 py-1">Input</td>
              <td className="px-2 py-1">Input / Output</td>
              <td className="px-2 py-1 font-mono">trigger=http, http.method=POST, http.path=/invoke, http.auth=jwt</td>
            </tr>
            <tr className="border-t border-gray-800">
              <td className="px-2 py-1">S3 Vector Store</td>
              <td className="px-2 py-1">Knowledge Base / RAG</td>
              <td className="px-2 py-1 font-mono">bucket=rag-vectors-prod, index_name=docs-index, embedding_model_id=amazon.titan-embed-text-v2:0</td>
            </tr>
            <tr className="border-t border-gray-800">
              <td className="px-2 py-1">Agent</td>
              <td className="px-2 py-1">Agents & Orchestration</td>
              <td className="px-2 py-1 font-mono">model_id=anthropic.claude-3-5-sonnet-20241022-v2:0, system_prompt=…, memory.enabled=true, memory.backend=dynamodb, memory.ttl_seconds=3600</td>
            </tr>
            <tr className="border-t border-gray-800">
              <td className="px-2 py-1">Output</td>
              <td className="px-2 py-1">Input / Output</td>
              <td className="px-2 py-1 font-mono">mode=json, status_code=200</td>
            </tr>
          </tbody>
        </table>
      </div>

      <P>Edges:</P>
      <Pre>{`Input.payload ──────────► Agent.message
S3 Vector Store.retriever ─► Agent.context
Agent.response ───────────► Output.payload`}</Pre>

      <Callout kind="info">
        With <Code>memory.enabled=true</Code>, the engine emits <Code>aws_bedrockagentcore_memory</Code>{' '}
        with semantic + summarization + user_preference strategies. Each turn calls{' '}
        <Code>create_event(actor_id, session_id, messages=…)</Code> and{' '}
        <Code>retrieve_memories(namespace, query, top_k)</Code>.
      </Callout>

      <H2>Ingestion pipeline: S3 → chunk → embed → S3 Vectors</H2>
      <P>Event-driven ingestion that fires on new objects in a source bucket.</P>

      <div className="overflow-x-auto mb-3">
        <table className="text-xs w-full border border-gray-800">
          <thead className="bg-gray-950 text-gray-400">
            <tr>
              <th className="px-2 py-1 text-left">Node</th>
              <th className="px-2 py-1 text-left">Category</th>
              <th className="px-2 py-1 text-left">Required config</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-t border-gray-800">
              <td className="px-2 py-1">Input</td>
              <td className="px-2 py-1">Input / Output</td>
              <td className="px-2 py-1 font-mono">trigger=s3_event, s3_event.bucket=rag-source-docs, s3_event.prefix=incoming/</td>
            </tr>
            <tr className="border-t border-gray-800">
              <td className="px-2 py-1">S3 Source</td>
              <td className="px-2 py-1">Ingestion Pipelines</td>
              <td className="px-2 py-1 font-mono">bucket=rag-source-docs, prefix=incoming/</td>
            </tr>
            <tr className="border-t border-gray-800">
              <td className="px-2 py-1">Chunking</td>
              <td className="px-2 py-1">Knowledge Base / RAG</td>
              <td className="px-2 py-1 font-mono">strategy=fixed_size, chunk_size=512, chunk_overlap=50</td>
            </tr>
            <tr className="border-t border-gray-800">
              <td className="px-2 py-1">Embedding</td>
              <td className="px-2 py-1">Knowledge Base / RAG</td>
              <td className="px-2 py-1 font-mono">model_id=amazon.titan-embed-text-v2:0, batch_size=100</td>
            </tr>
            <tr className="border-t border-gray-800">
              <td className="px-2 py-1">Output</td>
              <td className="px-2 py-1">Input / Output</td>
              <td className="px-2 py-1 font-mono">mode=json (writes vectors to s3_vectors.bucket / s3_vectors.index_name)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pre>{`S3 Source.documents ► Chunking.documents
Chunking.chunks ────► Embedding.chunks
Embedding.vectors ──► Output.payload`}</Pre>

      <H2>Other verified compositions</H2>
      <P>Every wiring below is type-checked against the catalog and known to connect in the canvas.</P>

      <ul className="text-sm text-gray-300 space-y-3 mb-3">
        <li>
          <strong>Plain Q&amp;A agent.</strong>
          <Pre>{`Input.payload ► Agent.message ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>RAG with explicit retriever node</strong> (control over query and top_k):
          <Pre>{`Input.payload ──────────► Retriever.query
S3 Vector Store.retriever ► Retriever.retriever
Retriever.documents ─────► Agent.context
Input.payload ──────────► Agent.message
Agent.response ─────────► Output.payload`}</Pre>
        </li>
        <li>
          <strong>Multi-agent supervisor</strong> (workers configured in coordinator.config.workers):
          <Pre>{`Input.payload ► Multi-Agent.task ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>HITL approval gate after agent</strong>:
          <Pre>{`Input.payload ► Agent.message
Agent.response ► Human in the Loop.payload
Human in the Loop.approved ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>Conditional routing on agent answer</strong>:
          <Pre>{`Agent.response ► Condition.payload
Condition.true  ► Output_yes.payload
Condition.false ► Output_no.payload`}</Pre>
        </li>
        <li>
          <strong>Athena query → agent context</strong>:
          <Pre>{`Input.payload ► Athena Query.params
Athena Query.results ► Agent.message
Agent.response ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>HTTP API tool → agent</strong>:
          <Pre>{`Input.payload ► HTTP Tool.request
HTTP Tool.response ► Agent.message
Agent.response ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>Code interpreter standalone</strong>:
          <Pre>{`Input.payload ► Code Interpreter.input ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>Browser tool → agent summarizer</strong>:
          <Pre>{`Input.payload ► Browser Tool.input
Browser Tool.result ► Agent.message
Agent.response ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>Loop fan-out over a list, per-item tool</strong>:
          <Pre>{`Input.payload ► Loop.items
Loop.item ► Custom Tool.input
Loop.results ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>Cache wrapping a slow tool</strong>:
          <Pre>{`Input.payload ► Cache.input
Cache.output ► HTTP Tool.request
HTTP Tool.response ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>Document parser ingestion</strong> (heterogeneous sources):
          <Pre>{`S3 Source.documents ► Document Parser.raw
Document Parser.document ► Chunking.documents
Chunking.chunks ► Embedding.chunks
Embedding.vectors ► Output.payload`}</Pre>
        </li>
        <li>
          <strong>Logger pass-through for audit</strong>:
          <Pre>{`Input.payload ► Logger.payload
Logger.payload ► Agent.message
Agent.response ► Output.payload`}</Pre>
        </li>
      </ul>

      <Callout kind="info">
        <strong>MCP client</strong> nodes do not connect via canvas edges. List the MCP client node
        ID in <Code>Agent.config.tools[]</Code> instead — the engine merges the MCP-discovered
        tools into the ReAct agent's tool list at compile time.
      </Callout>
    </>
  );
}

function Deploy() {
  return (
    <>
      <H1>☁️ Deploy</H1>

      <H2>Bundle layout</H2>
      <Pre>{`agent-{name}-{ts}.zip
├── agent/              ← LangGraph package (state.py, graph.py, runner.py, nodes/, tools/)
├── mcp_server/         ← MCP server (only when mcp_server node is present)
├── infra/              ← Terraform: agentcore.tf, agentcore_memory.tf, api_gateway.tf, iam.tf, lambda.tf, ecr.tf, …
├── tests/              ← pytest files (one per tool node)
├── local/              ← run_agent.py, run_workflow.py, mock_tools.py
├── Dockerfile          ← python:3.12-slim → "python -m agent.runner" on :8080
├── pyproject.toml      ← uv-managed deps; bedrock-agentcore included
├── .env.example        ← AgentCore env vars (no LangSmith)
└── project.json        ← Re-import schema`}</Pre>

      <H2>Local run</H2>
      <Pre>{`uv run pytest tests/ -v
uv run python local/run_agent.py --input '{"message": "Hello"}' --mock-tools
docker build -t my-agent . && docker run -p 8080:8080 my-agent`}</Pre>

      <H2>AWS deploy</H2>
      <Steps
        items={[
          <>Build &amp; push container: <Code>docker build -t agent .</Code> → tag with ECR URI from <Code>terraform output ecr_repository_url</Code> → <Code>docker push</Code>.</>,
          <><Code>cd infra/</Code> then <Code>terraform init -backend-config=backend.hcl</Code>.</>,
          <><Code>terraform plan -var-file=dev.tfvars</Code>; review.</>,
          <><Code>terraform apply -var-file=dev.tfvars</Code> — provisions AgentCore Runtime, Memory, API Gateway, tool Lambdas, IAM roles.</>,
          <>Outputs: <Code>api_gateway_url</Code>, <Code>agentcore_runtime_arn</Code>, <Code>agentcore_runtime_endpoint</Code>, optional <Code>memory_id</Code>, <Code>gateway_endpoint</Code>.</>,
        ]}
      />

      <H2>Invoke the deployed agent</H2>
      <Pre>{`# Public HTTP via API Gateway
curl -X POST $API_GATEWAY_URL/invoke \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello", "actor_id": "user-42"}'

# Direct AgentCore Runtime (SigV4 / A2A)
aws bedrock-agentcore invoke-agent-runtime \\
  --agent-runtime-arn $AGENTCORE_RUNTIME_ARN \\
  --payload '{"message": "Hello"}'`}</Pre>

      <Callout kind="info">
        AgentCore Runtime sessions persist 8 hours. Pass <Code>session_id</Code> to continue a
        conversation; AgentCore Memory recalls semantic facts/summaries/preferences scoped per{' '}
        <Code>actor_id</Code>.
      </Callout>
    </>
  );
}

function Troubleshooting() {
  return (
    <>
      <H1>🛟 Troubleshooting</H1>

      <H2>Validation errors</H2>
      <ul className="text-sm text-gray-300 space-y-2 mb-3 list-disc pl-5">
        <li>
          <strong>Red badge on node:</strong> open it in the right panel — required fields are
          marked. Code <Code>MISSING_REQUIRED_FIELD</Code> tells you which.
        </li>
        <li>
          <strong>Red edge / TYPE_MISMATCH:</strong> source port type ≠ target port type. Either
          change the port to <Code>any</Code> or insert a transformer node.
        </li>
        <li>
          <strong>CYCLE_DETECTED:</strong> remove the edge that points back upstream. For iteration
          use the <Code>loop</Code> node (LangGraph Send API).
        </li>
        <li>
          <strong>UNSAFE_QUERY_TEMPLATE</strong> on Athena: rewrite the query to use{' '}
          <Code>?</Code> positional placeholders; never f-string interpolate values.
        </li>
        <li>
          <strong>UNSUPPORTED_CACHE_BACKEND:</strong> v1 supports DynamoDB only. Set{' '}
          <Code>backend=dynamodb</Code>.
        </li>
      </ul>

      <H2>Runtime symptoms</H2>
      <ul className="text-sm text-gray-300 space-y-2 mb-3 list-disc pl-5">
        <li>
          <strong>HITL workflow won't resume:</strong> the engine injects a DynamoDB checkpointer
          only when an HITL node is present. Confirm the table exists and Lambda has{' '}
          <Code>dynamodb:*</Code> on it.
        </li>
        <li>
          <strong>Memory recall returns nothing:</strong> AgentCore extraction is async — first call
          stores, second call retrieves. Verify <Code>actor_id</Code> + <Code>session_id</Code> are
          consistent across invocations.
        </li>
        <li>
          <strong>Bedrock cross-region call fails:</strong> set{' '}
          <Code>inference_profile_arn</Code> on the agent/tool_bedrock node. It takes precedence
          over <Code>model_id</Code>.
        </li>
        <li>
          <strong>Container crash on AgentCore Runtime:</strong> tail the CloudWatch log group{' '}
          <Code>/aws/bedrock-agentcore/{'{agent_name}'}</Code>. Most cold-start issues are missing
          IAM permissions on the agentcore execution role.
        </li>
      </ul>

      <H2>Engine connectivity</H2>
      <P>
        If <strong>Validate</strong> or <strong>Generate ZIP</strong> shows an Error badge, the
        Studio cannot reach the engine. Confirm the engine is running (default{' '}
        <Code>http://localhost:8000</Code>) and the URL in <Code>studio/src/api/engine.ts</Code>{' '}
        matches.
      </P>
      <Pre>{`# Start the engine
cd engine
uv run uvicorn engine.main:app --reload --port 8000

# Health check
curl http://localhost:8000/health`}</Pre>
    </>
  );
}
