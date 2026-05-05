import type { DataType, NodePorts, NodeType } from '../types/graph';

export type NodeCategory =
  | 'Input / Output'
  | 'Agents & Orchestration'
  | 'Tools'
  | 'MCP'
  | 'Knowledge Base / RAG'
  | 'Ingestion Pipelines'
  | 'Flow Control';

export type FieldType = 'string' | 'textarea' | 'code' | 'enum' | 'boolean' | 'number' | 'secret_ref';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  language?: string;
}

export interface NodeDefinition {
  type: NodeType;
  label: string;
  description: string;
  category: NodeCategory;
  icon: string;
  categoryColor: string;
  defaultConfig: Record<string, unknown>;
  configSchema: FieldDef[];
  defaultPorts: NodePorts;
}

export const NODE_CATEGORIES: NodeCategory[] = [
  'Input / Output',
  'Agents & Orchestration',
  'Tools',
  'MCP',
  'Knowledge Base / RAG',
  'Ingestion Pipelines',
  'Flow Control',
];

const p = (id: string, name: string, data_type: DataType, required = false) => ({
  id,
  name,
  data_type,
  required,
});

export const NODE_CATALOG: Record<NodeType, NodeDefinition> = {
  input: {
    type: 'input',
    label: 'Input',
    description: 'Entry point — defines the trigger mechanism for the workflow.',
    category: 'Input / Output',
    icon: '⬇️',
    categoryColor: 'border-blue-500',
    defaultConfig: { trigger: 'http' },
    configSchema: [
      { key: 'trigger', label: 'Trigger type', type: 'enum', required: true, options: ['http', 's3_event', 'sqs', 'schedule'] },
      { key: 'http.method', label: 'HTTP method', type: 'enum', options: ['GET', 'POST', 'PUT', 'DELETE'] },
      { key: 'http.path', label: 'HTTP path', type: 'string', placeholder: '/invoke' },
      { key: 'http.auth', label: 'Auth', type: 'enum', options: ['none', 'jwt', 'api_key'] },
      { key: 'schedule.expression', label: 'Cron / rate expression', type: 'string', placeholder: 'rate(5 minutes)' },
      { key: 's3_event.bucket', label: 'S3 bucket', type: 'string' },
      { key: 's3_event.prefix', label: 'S3 key prefix', type: 'string' },
      { key: 'sqs.queue_url', label: 'SQS queue URL', type: 'string' },
      { key: 'sqs.batch_size', label: 'Batch size', type: 'number', min: 1, max: 10 },
    ],
    defaultPorts: {
      inputs: [],
      outputs: [p('payload', 'Payload', 'json')],
    },
  },

  output: {
    type: 'output',
    label: 'Output',
    description: 'Terminal node — defines the workflow response format.',
    category: 'Input / Output',
    icon: '⬆️',
    categoryColor: 'border-blue-500',
    defaultConfig: { mode: 'json', status_code: 200 },
    configSchema: [
      { key: 'mode', label: 'Mode', type: 'enum', required: true, options: ['json', 'stream', 's3_file'] },
      { key: 'status_code', label: 'HTTP status code', type: 'number', min: 100, max: 599 },
      { key: 's3.bucket', label: 'S3 bucket', type: 'string' },
      { key: 's3.key_template', label: 'S3 key template', type: 'string', placeholder: 'output/{{run_id}}.json' },
    ],
    defaultPorts: {
      inputs: [p('payload', 'Payload', 'any', true)],
      outputs: [],
    },
  },

  agent: {
    type: 'agent',
    label: 'Agent',
    description: 'LangGraph ReAct agent backed by Amazon Bedrock.',
    category: 'Agents & Orchestration',
    icon: '🤖',
    categoryColor: 'border-purple-500',
    defaultConfig: {
      model_id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      inference_profile_arn: '',
      system_prompt: 'You are a helpful AI assistant.',
      temperature: 0.7,
      max_tokens: 4096,
      streaming: false,
      tools: [],
    },
    configSchema: [
      { key: 'model_id', label: 'Bedrock model ID', type: 'string', placeholder: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
      { key: 'inference_profile_arn', label: 'Inference profile ARN', type: 'string', placeholder: 'arn:aws:bedrock:us-east-1:123:inference-profile/...', hint: 'Takes precedence over model ID when set. Required for cross-region inference.' },
      { key: 'system_prompt', label: 'System prompt', type: 'textarea', required: true },
      { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 1, step: 0.1 },
      { key: 'max_tokens', label: 'Max tokens', type: 'number', min: 1, max: 200000 },
      { key: 'streaming', label: 'Streaming', type: 'boolean' },
      { key: 'guardrails.guardrail_id', label: 'Guardrail ID', type: 'string' },
      { key: 'guardrails.guardrail_version', label: 'Guardrail version', type: 'string' },
      { key: 'memory.enabled', label: 'Memory enabled', type: 'boolean' },
      { key: 'memory.backend', label: 'Memory backend', type: 'enum', options: ['dynamodb', 'in_memory'] },
      { key: 'memory.ttl_seconds', label: 'Memory TTL (seconds)', type: 'number', min: 60 },
    ],
    defaultPorts: {
      inputs: [p('message', 'User message', 'string', true), p('context', 'Context', 'json')],
      outputs: [p('response', 'Agent response', 'string'), p('tool_calls', 'Tool calls log', 'json')],
    },
  },

  multi_agent_coordinator: {
    type: 'multi_agent_coordinator',
    label: 'Multi-Agent',
    description: 'Supervisor agent that routes tasks to sub-agents.',
    category: 'Agents & Orchestration',
    icon: '🎯',
    categoryColor: 'border-purple-500',
    defaultConfig: { model_id: '', system_prompt: '', routing_strategy: 'llm_based', max_iterations: 10, workers: [] },
    configSchema: [
      { key: 'model_id', label: 'Bedrock model ID', type: 'string', required: true },
      { key: 'system_prompt', label: 'System prompt', type: 'textarea', required: true },
      { key: 'routing_strategy', label: 'Routing strategy', type: 'enum', options: ['llm_based', 'rule_based'] },
      { key: 'max_iterations', label: 'Max iterations', type: 'number', min: 1, max: 100 },
    ],
    defaultPorts: {
      inputs: [p('task', 'Task', 'string', true)],
      outputs: [p('result', 'Result', 'json')],
    },
  },

  human_in_the_loop: {
    type: 'human_in_the_loop',
    label: 'Human in the Loop',
    description: 'Pauses workflow awaiting human approval via callback URL.',
    category: 'Agents & Orchestration',
    icon: '👤',
    categoryColor: 'border-purple-500',
    defaultConfig: { notification: 'email', notification_target: '', timeout_seconds: 86400, timeout_action: 'reject' },
    configSchema: [
      { key: 'notification', label: 'Notification method', type: 'enum', required: true, options: ['email', 'sns', 'slack_webhook'] },
      { key: 'notification_target', label: 'Notification target', type: 'string', required: true, placeholder: 'reviewer@example.com' },
      { key: 'timeout_seconds', label: 'Timeout (seconds)', type: 'number', min: 60 },
      { key: 'timeout_action', label: 'Timeout action', type: 'enum', options: ['reject', 'approve'] },
    ],
    defaultPorts: {
      inputs: [p('payload', 'Payload for review', 'json', true)],
      outputs: [p('approved', 'Approved', 'json'), p('rejected', 'Rejected', 'string')],
    },
  },

  tool_custom: {
    type: 'tool_custom',
    label: 'Custom Tool',
    description: 'Custom Python function executed in a Lambda.',
    category: 'Tools',
    icon: '⚡',
    categoryColor: 'border-orange-500',
    defaultConfig: { name: '', description: '', runtime: 'inline', inline_code: 'def handler(input):\n    return {"result": input}', timeout_seconds: 30, memory_mb: 256 },
    configSchema: [
      { key: 'name', label: 'Function name (snake_case)', type: 'string', required: true, placeholder: 'my_custom_tool' },
      { key: 'description', label: 'Description (shown to LLM)', type: 'textarea', required: true },
      { key: 'runtime', label: 'Runtime', type: 'enum', options: ['inline', 'lambda_arn'] },
      { key: 'inline_code', label: 'Inline code (Python)', type: 'code', language: 'python' },
      { key: 'lambda_arn', label: 'Lambda ARN', type: 'string', placeholder: 'arn:aws:lambda:...' },
      { key: 'timeout_seconds', label: 'Timeout (seconds)', type: 'number', min: 1, max: 900 },
      { key: 'memory_mb', label: 'Memory (MB)', type: 'number', min: 128, max: 10240 },
    ],
    defaultPorts: {
      inputs: [p('input', 'Input', 'json', true)],
      outputs: [p('output', 'Output', 'json')],
    },
  },

  tool_athena: {
    type: 'tool_athena',
    label: 'Athena Query',
    description: 'Parameterized SQL query on Amazon Athena.',
    category: 'Tools',
    icon: '🔍',
    categoryColor: 'border-orange-500',
    defaultConfig: { name: '', description: '', database: '', workgroup: 'primary', query_template: '', output_location: '', max_rows: 100 },
    configSchema: [
      { key: 'name', label: 'Tool name', type: 'string', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'database', label: 'Database', type: 'string', required: true },
      { key: 'workgroup', label: 'Workgroup', type: 'string' },
      { key: 'query_template', label: 'SQL query (use ? for params)', type: 'code', required: true, language: 'sql', hint: 'Use ? positional placeholders only. String interpolation is prohibited.' },
      { key: 'output_location', label: 'S3 output location', type: 'string', required: true, placeholder: 's3://bucket/athena-results/' },
      { key: 'max_rows', label: 'Max rows', type: 'number', min: 1, max: 10000 },
    ],
    defaultPorts: {
      inputs: [p('params', 'Query parameters', 'json', true)],
      outputs: [p('results', 'Query results', 'json')],
    },
  },

  tool_s3: {
    type: 'tool_s3',
    label: 'S3 Tool',
    description: 'Read from or write to an S3 bucket.',
    category: 'Tools',
    icon: '🪣',
    categoryColor: 'border-orange-500',
    defaultConfig: { name: '', description: '', operation: 'read', bucket: '', key_template: '' },
    configSchema: [
      { key: 'name', label: 'Tool name', type: 'string', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'operation', label: 'Operation', type: 'enum', required: true, options: ['read', 'write', 'list'] },
      { key: 'bucket', label: 'S3 bucket', type: 'string', required: true },
      { key: 'key_template', label: 'Key template', type: 'string', placeholder: 'data/{{variable}}.json' },
    ],
    defaultPorts: {
      inputs: [p('input', 'Input', 'any', true)],
      outputs: [p('output', 'Output', 'any')],
    },
  },

  tool_http: {
    type: 'tool_http',
    label: 'HTTP Tool',
    description: 'Call an external HTTP API.',
    category: 'Tools',
    icon: '🌐',
    categoryColor: 'border-orange-500',
    defaultConfig: { name: '', description: '', base_url: '', method: 'POST', auth: { type: 'none' }, timeout_seconds: 30 },
    configSchema: [
      { key: 'name', label: 'Tool name', type: 'string', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'base_url', label: 'Base URL', type: 'string', required: true, placeholder: 'https://api.example.com' },
      { key: 'method', label: 'HTTP method', type: 'enum', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'auth.type', label: 'Auth type', type: 'enum', options: ['none', 'api_key', 'bearer', 'oauth2_client_credentials'] },
      { key: 'auth.secret_ref', label: 'Secret reference', type: 'secret_ref', placeholder: 'secret://my-api-key' },
      { key: 'auth.oauth2.token_url', label: 'OAuth2 token URL', type: 'string' },
      { key: 'auth.oauth2.scope', label: 'OAuth2 scope', type: 'string' },
      { key: 'timeout_seconds', label: 'Timeout (seconds)', type: 'number', min: 1, max: 900 },
    ],
    defaultPorts: {
      inputs: [p('request', 'Request', 'json', true)],
      outputs: [p('response', 'Response', 'json'), p('status_code', 'Status code', 'string')],
    },
  },

  tool_bedrock: {
    type: 'tool_bedrock',
    label: 'Bedrock Tool',
    description: 'Direct Bedrock API call — model invocation, agent invocation, or batch inference.',
    category: 'Tools',
    icon: '🧠',
    categoryColor: 'border-orange-500',
    defaultConfig: { name: '', description: '', operation: 'invoke_model', model_id: '', inference_profile_arn: '', timeout_seconds: 30 },
    configSchema: [
      { key: 'name', label: 'Tool name', type: 'string', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'operation', label: 'Operation', type: 'enum', required: true, options: ['invoke_model', 'invoke_agent', 'invoke_model_with_response_stream'] },
      { key: 'model_id', label: 'Bedrock model ID', type: 'string' },
      { key: 'inference_profile_arn', label: 'Inference profile ARN', type: 'string', hint: 'Takes precedence over model ID.' },
      { key: 'agent_id', label: 'Bedrock Agent ID', type: 'string', hint: 'Required when operation=invoke_agent' },
      { key: 'agent_alias_id', label: 'Agent alias ID', type: 'string' },
      { key: 'body_template', label: 'Request body template (JSON)', type: 'code', language: 'json' },
      { key: 'timeout_seconds', label: 'Timeout (seconds)', type: 'number', min: 1, max: 900 },
    ],
    defaultPorts: {
      inputs: [p('input', 'Input', 'json', true)],
      outputs: [p('output', 'Output', 'json')],
    },
  },

  mcp_server: {
    type: 'mcp_server',
    label: 'MCP Server',
    description: 'Exposes an MCP server running on AgentCore Runtime.',
    category: 'MCP',
    icon: '📡',
    categoryColor: 'border-yellow-500',
    defaultConfig: { name: '', transport: 'stdio', tools: [], resources: [] },
    configSchema: [
      { key: 'name', label: 'Server name', type: 'string', required: true },
      { key: 'transport', label: 'Transport', type: 'enum', options: ['stdio', 'sse'] },
    ],
    defaultPorts: {
      inputs: [],
      outputs: [p('server_url', 'Server URL', 'string')],
    },
  },

  mcp_client: {
    type: 'mcp_client',
    label: 'MCP Client',
    description: 'Connects to an external MCP server and exposes its tools to agents.',
    category: 'MCP',
    icon: '🔗',
    categoryColor: 'border-yellow-500',
    defaultConfig: { server_url: '', transport: 'sse', auth: { type: 'none' } },
    configSchema: [
      { key: 'server_url', label: 'Server URL', type: 'string', required: true },
      { key: 'transport', label: 'Transport', type: 'enum', options: ['stdio', 'sse'] },
      { key: 'auth.type', label: 'Auth type', type: 'enum', options: ['none', 'bearer'] },
      { key: 'auth.secret_ref', label: 'Secret reference', type: 'secret_ref', placeholder: 'secret://mcp-token' },
    ],
    defaultPorts: {
      inputs: [],
      outputs: [p('tools', 'Available tools', 'json')],
    },
  },

  kb_s3_vector: {
    type: 'kb_s3_vector',
    label: 'S3 Vector Store',
    description: 'Amazon S3 Vectors vector store connection.',
    category: 'Knowledge Base / RAG',
    icon: '📚',
    categoryColor: 'border-green-500',
    defaultConfig: { bucket: '', index_name: '', embedding_model_id: 'amazon.titan-embed-text-v2:0' },
    configSchema: [
      { key: 'bucket', label: 'S3 Vectors bucket', type: 'string', required: true },
      { key: 'index_name', label: 'Index name', type: 'string', required: true },
      { key: 'embedding_model_id', label: 'Embedding model ID', type: 'string', required: true },
    ],
    defaultPorts: {
      inputs: [],
      outputs: [p('retriever', 'Retriever', 'retriever')],
    },
  },

  kb_bedrock: {
    type: 'kb_bedrock',
    label: 'Bedrock Knowledge Base',
    description: 'Amazon Bedrock managed Knowledge Base.',
    category: 'Knowledge Base / RAG',
    icon: '📖',
    categoryColor: 'border-green-500',
    defaultConfig: { knowledge_base_id: '', retrieval_config: { number_of_results: 5, search_type: 'SEMANTIC' } },
    configSchema: [
      { key: 'knowledge_base_id', label: 'Knowledge Base ID', type: 'string', required: true },
      { key: 'retrieval_config.number_of_results', label: 'Number of results', type: 'number', min: 1, max: 100 },
      { key: 'retrieval_config.search_type', label: 'Search type', type: 'enum', options: ['SEMANTIC', 'HYBRID'] },
    ],
    defaultPorts: {
      inputs: [],
      outputs: [p('retriever', 'Retriever', 'retriever')],
    },
  },

  chunking: {
    type: 'chunking',
    label: 'Chunking',
    description: 'Splits documents into chunks with configurable strategies.',
    category: 'Knowledge Base / RAG',
    icon: '✂️',
    categoryColor: 'border-green-500',
    defaultConfig: { strategy: 'fixed_size', chunk_size: 512, chunk_overlap: 50 },
    configSchema: [
      { key: 'strategy', label: 'Strategy', type: 'enum', options: ['fixed_size', 'semantic', 'by_section'] },
      { key: 'chunk_size', label: 'Chunk size (tokens)', type: 'number', min: 64, max: 8192 },
      { key: 'chunk_overlap', label: 'Chunk overlap (tokens)', type: 'number', min: 0, max: 512 },
    ],
    defaultPorts: {
      inputs: [p('documents', 'Documents', 'document', true)],
      outputs: [p('chunks', 'Chunks', 'document')],
    },
  },

  embedding: {
    type: 'embedding',
    label: 'Embedding',
    description: 'Vectorizes chunks using a Bedrock embedding model.',
    category: 'Knowledge Base / RAG',
    icon: '🔢',
    categoryColor: 'border-green-500',
    defaultConfig: { model_id: 'amazon.titan-embed-text-v2:0', batch_size: 100 },
    configSchema: [
      { key: 'model_id', label: 'Embedding model ID', type: 'string', required: true },
      { key: 'batch_size', label: 'Batch size', type: 'number', min: 1, max: 500 },
    ],
    defaultPorts: {
      inputs: [p('chunks', 'Chunks', 'document', true)],
      outputs: [p('vectors', 'Vectors', 'vector')],
    },
  },

  retriever: {
    type: 'retriever',
    label: 'Retriever',
    description: 'Runs a semantic query against a vector store.',
    category: 'Knowledge Base / RAG',
    icon: '🔎',
    categoryColor: 'border-green-500',
    defaultConfig: { top_k: 5 },
    configSchema: [
      { key: 'top_k', label: 'Top K results', type: 'number', min: 1, max: 100 },
    ],
    defaultPorts: {
      inputs: [p('query', 'Query', 'string', true), p('retriever', 'Retriever', 'retriever', true)],
      outputs: [p('documents', 'Documents', 'document')],
    },
  },

  s3_source: {
    type: 's3_source',
    label: 'S3 Source',
    description: 'Loads documents from an S3 bucket.',
    category: 'Ingestion Pipelines',
    icon: '📂',
    categoryColor: 'border-teal-500',
    defaultConfig: { bucket: '', prefix: '', file_types: ['pdf', 'txt', 'docx'] },
    configSchema: [
      { key: 'bucket', label: 'S3 bucket', type: 'string', required: true },
      { key: 'prefix', label: 'Key prefix', type: 'string' },
    ],
    defaultPorts: {
      inputs: [],
      outputs: [p('documents', 'Documents', 'document')],
    },
  },

  document_parser: {
    type: 'document_parser',
    label: 'Document Parser',
    description: 'Parses raw bytes into structured document objects.',
    category: 'Ingestion Pipelines',
    icon: '📄',
    categoryColor: 'border-teal-500',
    defaultConfig: { strategy: 'auto' },
    configSchema: [
      { key: 'strategy', label: 'Parse strategy', type: 'enum', options: ['auto', 'fast', 'hi_res'] },
    ],
    defaultPorts: {
      inputs: [p('raw', 'Raw document', 'any', true)],
      outputs: [p('document', 'Parsed document', 'document')],
    },
  },

  ingest_pipeline: {
    type: 'ingest_pipeline',
    label: 'Ingest Pipeline',
    description: 'End-to-end ingestion: parse → chunk → embed → store.',
    category: 'Ingestion Pipelines',
    icon: '🔄',
    categoryColor: 'border-teal-500',
    defaultConfig: { chunk_size: 512, embedding_model_id: 'amazon.titan-embed-text-v2:0' },
    configSchema: [
      { key: 'chunk_size', label: 'Chunk size', type: 'number', min: 64, max: 8192 },
      { key: 'embedding_model_id', label: 'Embedding model ID', type: 'string', required: true },
    ],
    defaultPorts: {
      inputs: [p('documents', 'Documents', 'document', true)],
      outputs: [p('vectors', 'Vectors', 'vector')],
    },
  },

  condition: {
    type: 'condition',
    label: 'Condition',
    description: 'Routes flow based on a JMESPath or CEL expression.',
    category: 'Flow Control',
    icon: '🔀',
    categoryColor: 'border-pink-500',
    defaultConfig: { expression: '', expression_language: 'jmespath' },
    configSchema: [
      { key: 'expression_language', label: 'Expression language', type: 'enum', required: true, options: ['jmespath', 'cel'], hint: 'eval() is prohibited.' },
      { key: 'expression', label: 'Expression', type: 'string', required: true, placeholder: 'response == `yes`' },
    ],
    defaultPorts: {
      inputs: [p('payload', 'Payload', 'any', true)],
      outputs: [p('true', 'True', 'any'), p('false', 'False', 'any')],
    },
  },

  loop: {
    type: 'loop',
    label: 'Loop',
    description: 'Fan-out iteration over a list of items using LangGraph Send API.',
    category: 'Flow Control',
    icon: '🔁',
    categoryColor: 'border-pink-500',
    defaultConfig: { max_concurrency: 10 },
    configSchema: [
      { key: 'max_concurrency', label: 'Max concurrency', type: 'number', min: 1, max: 100, hint: 'Maximum parallel iterations.' },
    ],
    defaultPorts: {
      inputs: [p('items', 'Items', 'json', true)],
      outputs: [p('item', 'Item (per-iteration)', 'any'), p('results', 'Results (post-loop)', 'json')],
    },
  },

  cache: {
    type: 'cache',
    label: 'Cache',
    description: 'DynamoDB-backed cache. Returns cached value on hit.',
    category: 'Flow Control',
    icon: '💾',
    categoryColor: 'border-pink-500',
    defaultConfig: { key_expression: '', ttl_seconds: 3600, table_name: '' },
    configSchema: [
      { key: 'key_expression', label: 'Cache key expression (JMESPath)', type: 'string', required: true },
      { key: 'ttl_seconds', label: 'TTL (seconds)', type: 'number', min: 60 },
      { key: 'table_name', label: 'DynamoDB table name', type: 'string' },
    ],
    defaultPorts: {
      inputs: [p('input', 'Input', 'any', true)],
      outputs: [p('output', 'Output', 'any'), p('cache_hit', 'Cache hit', 'boolean')],
    },
  },

  logger: {
    type: 'logger',
    label: 'Logger',
    description: 'Emits a structured CloudWatch log entry and passes payload through.',
    category: 'Flow Control',
    icon: '📝',
    categoryColor: 'border-pink-500',
    defaultConfig: { level: 'INFO', message_template: '{{payload}}' },
    configSchema: [
      { key: 'level', label: 'Log level', type: 'enum', options: ['DEBUG', 'INFO', 'WARNING', 'ERROR'] },
      { key: 'message_template', label: 'Message template', type: 'string' },
    ],
    defaultPorts: {
      inputs: [p('payload', 'Payload', 'any', true)],
      outputs: [p('payload', 'Payload (pass-through)', 'any')],
    },
  },
};

export const CATEGORY_NODES: Record<NodeCategory, NodeType[]> = {
  'Input / Output': ['input', 'output'],
  'Agents & Orchestration': ['agent', 'multi_agent_coordinator', 'human_in_the_loop'],
  'Tools': ['tool_custom', 'tool_athena', 'tool_s3', 'tool_http', 'tool_bedrock'],
  'MCP': ['mcp_server', 'mcp_client'],
  'Knowledge Base / RAG': ['kb_s3_vector', 'kb_bedrock', 'chunking', 'embedding', 'retriever'],
  'Ingestion Pipelines': ['s3_source', 'document_parser', 'ingest_pipeline'],
  'Flow Control': ['condition', 'loop', 'cache', 'logger'],
};

export const PORT_COLORS: Record<string, string> = {
  any: 'bg-gray-400',
  string: 'bg-blue-400',
  json: 'bg-orange-400',
  document: 'bg-purple-400',
  vector: 'bg-teal-400',
  retriever: 'bg-pink-400',
  control: 'bg-yellow-400',
  boolean: 'bg-green-400',
};

export const DATA_TYPE_COMPATIBLE = (source: string, target: string): boolean => {
  if (target === 'any' || source === 'any') return true;
  return source === target;
};
