# Graph Report - .  (2026-05-06)

## Corpus Check
- Corpus is ~29,940 words - fits in a single context window. You may not need a graph.

## Summary
- 318 nodes · 578 edges · 34 communities (25 shown, 9 thin omitted)
- Extraction: 72% EXTRACTED · 28% INFERRED · 0% AMBIGUOUS · INFERRED: 163 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_AgentCore Gaps & Platform Docs|AgentCore Gaps & Platform Docs]]
- [[_COMMUNITY_Node Code Generators|Node Code Generators]]
- [[_COMMUNITY_Validator & Graph Model|Validator & Graph Model]]
- [[_COMMUNITY_Config & Graph Codegen|Config & Graph Codegen]]
- [[_COMMUNITY_Platform Architecture & Auth|Platform Architecture & Auth]]
- [[_COMMUNITY_Graph Compiler Core|Graph Compiler Core]]
- [[_COMMUNITY_Test Generator & Artifacts|Test Generator & Artifacts]]
- [[_COMMUNITY_FastAPI Engine & Scaffold|FastAPI Engine & Scaffold]]
- [[_COMMUNITY_Tool Code Generators|Tool Code Generators]]
- [[_COMMUNITY_Port Compatibility UI|Port Compatibility UI]]
- [[_COMMUNITY_Studio API Client|Studio API Client]]
- [[_COMMUNITY_Input Node Type|Input Node Type]]
- [[_COMMUNITY_Output Node Type|Output Node Type]]
- [[_COMMUNITY_Multi-Agent Coordinator|Multi-Agent Coordinator]]
- [[_COMMUNITY_Custom Tool Node|Custom Tool Node]]
- [[_COMMUNITY_S3 Tool Node|S3 Tool Node]]
- [[_COMMUNITY_MCP Client Node|MCP Client Node]]
- [[_COMMUNITY_Retriever Node|Retriever Node]]
- [[_COMMUNITY_LangChain Integration|LangChain Integration]]

## God Nodes (most connected - your core abstractions)
1. `CompiledFile` - 56 edges
2. `validate()` - 31 edges
3. `Project` - 21 edges
4. `compile_graph()` - 21 edges
5. `make_node()` - 17 edges
6. `generate_iac()` - 16 edges
7. `_state_key()` - 16 edges
8. `_first_input_key()` - 13 edges
9. `ValidationError` - 10 edges
10. `AgentCore Gap Analysis` - 10 edges

## Surprising Connections (you probably didn't know these)
- `AgentCore Memory Gap` --semantically_similar_to--> `Canvas Autosave to DynamoDB`  [INFERRED] [semantically similar]
  docs/agentcore-gaps.md → generative-agents-platform-spec.md
- `Generative Agents Platform User Guide` --references--> `Generative Agents Platform Technical Specification`  [INFERRED]
  docs/user-guide.md → generative-agents-platform-spec.md
- `compile_graph()` --calls--> `generate_tool()`  [INFERRED]
  engine/engine/pipeline/compiler/compiler.py → engine/engine/pipeline/compiler/tool_gen.py
- `Generative Agents Platform (CLAUDE.md)` --references--> `Generative Agents Platform Technical Specification`  [EXTRACTED]
  CLAUDE.md → generative-agents-platform-spec.md
- `AgentCore Gap Analysis` --references--> `Generative Agents Platform Technical Specification`  [EXTRACTED]
  docs/agentcore-gaps.md → generative-agents-platform-spec.md

## Hyperedges (group relationships)
- **Code Generation Engine Sequential Pipeline** — spec_validator, spec_graph_compiler, spec_iac_generator, spec_test_generator, spec_local_runner_scaffold, spec_observability_injector, spec_zip_bundler [EXTRACTED 1.00]
- **RAG Ingestion Pipeline Node Flow** — spec_node_s3_source, spec_node_document_parser, spec_node_chunking, spec_node_embedding, spec_node_kb_s3_vector [EXTRACTED 1.00]
- **Four-Layer Platform Architecture** — spec_studio_layer, spec_engine_layer, spec_artifacts_layer, spec_aws_runtime_layer [EXTRACTED 1.00]

## Communities (34 total, 9 thin omitted)

### Community 0 - "AgentCore Gaps & Platform Docs"
Cohesion: 0.05
Nodes (53): AgentCore Gap Analysis, Generative Agents Platform User Guide, AgentCore Gateway Gap, AgentCore Identity Gap, AgentCore Memory Gap, AgentCore Runtime Gap, Browser Tool Node Missing, Code Interpreter Node Missing (+45 more)

### Community 1 - "Node Code Generators"
Cohesion: 0.09
Nodes (47): _first_input_key(), _gen_agent(), _gen_browser_tool(), _gen_cache(), _gen_code_interpreter(), _gen_condition(), _gen_coordinator(), _gen_hitl() (+39 more)

### Community 2 - "Validator & Graph Model"
Cohesion: 0.11
Nodes (34): Node, Project, _check_edge_references(), _check_edge_types(), _check_entry_exit(), _check_required_config(), _check_security_constraints(), Phase 1: Validates the graph DAG before code generation. (+26 more)

### Community 3 - "Config & Graph Codegen"
Cohesion: 0.09
Nodes (24): BaseModel, Phase 2: Graph Compiler — orchestrates all code generation sub-phases., generate_config(), Generates agent/config.py — environment variables and lazy secret fetching., generate_graph(), Generates agent/graph.py — StateGraph assembly., generate_runner(), Generates agent/runner.py — Lambda handler, AgentCore App, and CLI entrypoint. (+16 more)

### Community 4 - "Platform Architecture & Auth"
Cohesion: 0.1
Nodes (25): Generative Agents Platform (CLAUDE.md), Generated Artifacts (Layer 3), Authentication: Amazon Cognito, Authentication: Corporate SSO (SAML/OIDC), AWS Runtime (Layer 4), Amazon CloudWatch, Code Generation Engine (Layer 2), IaC Generator (Terraform) (+17 more)

### Community 5 - "Graph Compiler Core"
Cohesion: 0.13
Nodes (20): compile_graph(), Translates the validated DAG into a full Python agent package under agent/., generate_node(), Returns a CompiledFile for this node, or None if no node function needed., collect_state_fields(), generate_state(), _is_message_edge(), Generates agent/state.py from the DAG's edge graph. (+12 more)

### Community 6 - "Test Generator & Artifacts"
Cohesion: 0.17
Nodes (14): CompiledArtifacts, All files produced by the full pipeline, keyed by path inside the ZIP., Merge another CompiledArtifacts into this one (other wins on collision)., _fn_name(), _gen_conftest(), _gen_tool_test(), generate_tests(), Phase 4: Test Generator — emits pytest files, one per tool node. (+6 more)

### Community 7 - "FastAPI Engine & Scaffold"
Cohesion: 0.18
Nodes (13): generate(), FastAPI application — Code Generation Engine., Validate a graph DAG without generating code.      Returns validation errors as, Validate the graph and generate a deployable ZIP bundle.      Returns a ZIP file, validate_graph(), _gen_dockerfile(), _gen_env_example(), _gen_mock_tools() (+5 more)

### Community 8 - "Tool Code Generators"
Cohesion: 0.22
Nodes (14): _fn_name(), _gen_tool_athena(), _gen_tool_bedrock(), _gen_tool_custom(), _gen_tool_http(), _gen_tool_s3(), generate_tool(), generate_tools_init() (+6 more)

### Community 9 - "Port Compatibility UI"
Cohesion: 0.24
Nodes (3): getCompatibleSources(), getCompatibleTargets(), DATA_TYPE_COMPATIBLE()

## Knowledge Gaps
- **75 isolated node(s):** `FastAPI application — Code Generation Engine.`, `Validate a graph DAG without generating code.      Returns validation errors as`, `Validate the graph and generate a deployable ZIP bundle.      Returns a ZIP file`, `Shared types for the code generation pipeline.`, `A single generated file: its path inside the ZIP and its text content.` (+70 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CompiledFile` connect `Node Code Generators` to `Config & Graph Codegen`, `Graph Compiler Core`, `Test Generator & Artifacts`, `FastAPI Engine & Scaffold`, `Tool Code Generators`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `Project` connect `Validator & Graph Model` to `Config & Graph Codegen`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `compile_graph()` connect `Graph Compiler Core` to `Node Code Generators`, `Validator & Graph Model`, `Config & Graph Codegen`, `Test Generator & Artifacts`, `FastAPI Engine & Scaffold`, `Tool Code Generators`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Are the 54 inferred relationships involving `CompiledFile` (e.g. with `_gen_ecr_tf()` and `_gen_main_tf()`) actually correct?**
  _`CompiledFile` has 54 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `validate()` (e.g. with `validate_graph()` and `generate()`) actually correct?**
  _`validate()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `Project` (e.g. with `ValidationError` and `ValidationResult`) actually correct?**
  _`Project` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `compile_graph()` (e.g. with `generate()` and `CompiledArtifacts`) actually correct?**
  _`compile_graph()` has 19 INFERRED edges - model-reasoned connections that need verification._