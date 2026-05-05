export const SERVICE_LINE_GROUPS = [
  { label: 'CRM & ERP Platforms',   color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-500' },
  { label: 'ITSM & Workflow',        color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500'  },
  { label: 'Custom Development',     color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  { label: 'Frontend Frameworks',    color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  { label: 'AI & Intelligence',      color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500'    },
  { label: 'Cloud Platforms',        color: 'text-sky-500',    bg: 'bg-sky-50',    border: 'border-sky-200',    dot: 'bg-sky-500'    },
]

export const SERVICE_LINE_STANDARDS = [
  // ── CRM & ERP Platforms ──────────────────────────────────────────────────────
  {
    name: 'Salesforce',
    code: 'salesforce',
    group: 'CRM & ERP Platforms',
    description: 'Sales Cloud, Service Cloud, Experience Cloud, MuleSoft, Tableau CRM',
    subtext: 'Declarative config, metadata-driven, governor limits, upgrade cycles',
    tech: ['Apex', 'LWC', 'Aura', 'Flow', 'SOQL', 'MuleSoft', 'Tableau CRM', 'REST/SOAP APIs'],
    patterns: [
      { name: 'Trigger Framework',  desc: 'Centralized trigger handler per object — no logic in trigger files' },
      { name: 'Service Layer',      desc: 'Business logic isolated from DML and SOQL layers' },
      { name: 'Selector Pattern',   desc: 'All SOQL queries centralised in Selector classes' },
      { name: 'Unit of Work',       desc: 'DML operations batched and committed in one transaction' },
    ],
    folder: `force-app/main/default/\n├── classes/\n│   ├── triggers/      ← handlers\n│   ├── services/\n│   ├── selectors/\n│   └── tests/\n├── lwc/\n├── flows/\n├── objects/\n└── permissionsets/`,
    nfr: [
      'Governor limits: SOQL < 100, DML < 150 per transaction',
      'Bulkification — all code must handle 200-record batches',
      'Selective SOQL queries (indexed field filters)',
      'Async processing via Queueable / Batch Apex for heavy jobs',
    ],
    key_components: ['Trigger Handler', 'Service Class', 'Selector Class', 'Test Factory', 'Custom Metadata'],
  },
  {
    name: 'NetSuite',
    code: 'netsuite',
    group: 'CRM & ERP Platforms',
    description: 'SuiteCloud, SuiteScript, SuiteFlow, SuiteAnalytics',
    subtext: 'ERP/CRM unified, SuiteScript governance, multi-subsidiary',
    tech: ['SuiteScript 2.x', 'SuiteFlow', 'SuiteQL', 'RESTlets', 'SuiteTalk SOAP', 'SuiteAnalytics Connect'],
    patterns: [
      { name: 'Script Deployment',  desc: 'Logic decoupled from deployment configuration records' },
      { name: 'Map/Reduce',         desc: 'High-volume record processing split across stages' },
      { name: 'Suitelet MVC',       desc: 'UI page logic separated from server-side rendering' },
      { name: 'Scheduled Script',   desc: 'Background job orchestration with governance awareness' },
    ],
    folder: `src/\n├── FileCabinet/SuiteScripts/\n│   ├── UserEvent/\n│   ├── ScheduledScripts/\n│   ├── MapReduce/\n│   └── RESTlets/\n├── Objects/\n└── Translations/`,
    nfr: [
      'Script governance limit compliance (10,000 units per execution)',
      'Async Map/Reduce for bulk data operations',
      'SuiteQL optimized — avoid full-table scans',
      'Multi-subsidiary data isolation enforced per script',
    ],
    key_components: ['User Event Script', 'Client Script', 'RESTlet API', 'Saved Search', 'Custom Record'],
  },
  {
    name: 'SAP',
    code: 'sap',
    group: 'CRM & ERP Platforms',
    description: 'S/4HANA, BTP, Fiori, ABAP, CAP',
    subtext: 'Enterprise ERP, Fiori UX, BTP extensions, ABAP + CAP',
    tech: ['ABAP', 'CAP (Node.js/Java)', 'SAP Fiori', 'BTP', 'OData v4', 'S/4HANA APIs', 'RAP', 'CDS Views'],
    patterns: [
      { name: 'MVC (Fiori)',          desc: 'SAPUI5 View–Controller–Model with XML views' },
      { name: 'CDS View-Based',       desc: 'Core Data Services as the single source of truth for data' },
      { name: 'OData Service Layer',  desc: 'REST-compliant API exposition via OData v4' },
      { name: 'BTP Side-by-Side',     desc: 'Custom extensions on BTP without modifying core SAP' },
    ],
    folder: `app/\n├── webapp/\n│   ├── view/\n│   ├── controller/\n│   ├── model/\n│   └── i18n/\nsrv/\n│   └── service.cds\ndb/\n│   └── schema.cds`,
    nfr: [
      'RFC/BAPI call optimization — minimize round-trips',
      'ABAP memory limits compliance (roll area, heap)',
      'Batch processing for mass data (BATCH INPUT / LSMW)',
      'Fiori initial load < 3s on standard hardware',
    ],
    key_components: ['CDS View', 'OData Service', 'Fiori App', 'BTP Workflow', 'Enhancement Implementation'],
  },
  {
    name: 'Oracle Applications',
    code: 'oracle',
    group: 'CRM & ERP Platforms',
    description: 'Oracle Cloud ERP/HCM/SCM, APEX, PL/SQL, OIC',
    subtext: 'Oracle Cloud SaaS, FBDI, OIC integration, VBCS',
    tech: ['PL/SQL', 'Oracle APEX', 'OIC', 'VBCS', 'ORDS REST', 'JET Framework', 'FBDI', 'HDL'],
    patterns: [
      { name: 'MVC (APEX)',        desc: 'Page Designer components with process/region separation' },
      { name: 'API-First (ORDS)', desc: 'ORDS REST APIs as the primary integration surface' },
      { name: 'FBDI Pattern',      desc: 'File-Based Data Import for high-volume bulk loads' },
      { name: 'OIC Flow',          desc: 'Oracle Integration Cloud for cross-system orchestration' },
    ],
    folder: `src/\n├── apex/\n│   ├── pages/\n│   └── plugins/\n├── plsql/\n│   ├── packages/\n│   └── procedures/\n├── ords/\n│   └── modules/\n└── integrations/`,
    nfr: [
      'PL/SQL bind variables — no dynamic SQL without them',
      'Connection pool sizing for concurrent user peak',
      'FBDI batch size tuned for throughput vs locking',
      'OIC error handling with DLQ and retry policies',
    ],
    key_components: ['APEX Application', 'PL/SQL Package', 'ORDS Module', 'OIC Integration', 'BI Publisher Report'],
  },

  // ── ITSM & Workflow ──────────────────────────────────────────────────────────
  {
    name: 'ServiceNow',
    code: 'servicenow',
    group: 'ITSM & Workflow',
    description: 'ITSM, ITOM, ITBM, Flow Designer, Service Portal',
    subtext: 'Scoped apps, CMDB, ITIL alignment, Now Platform',
    tech: ['Flow Designer', 'Script Includes', 'UI Policies', 'Client Scripts', 'REST API', 'ATF', 'IntegrationHub'],
    patterns: [
      { name: 'Scoped Application', desc: 'All customizations in a scoped app for namespace isolation' },
      { name: 'CMDB-Centric',       desc: 'Configuration Item as the data foundation for all processes' },
      { name: 'ITSM Process Flow',  desc: 'Incident → Problem → Change pipeline with SLA enforcement' },
      { name: 'IntegrationHub Spoke', desc: 'Pre-built connector patterns via certified spokes' },
    ],
    folder: `src/\n├── Script Includes/\n├── Business Rules/\n├── Client Scripts/\n├── UI Policies/\n├── Widgets/\n│   └── Service Portal/\n└── Flow Actions/`,
    nfr: [
      'Transaction log compliance — avoid synchronous heavy scripts',
      'Memory limit per script execution (< 512 MB)',
      'Scheduled job concurrency within instance limits',
      'ATF test coverage > 80% for all scoped app logic',
    ],
    key_components: ['Script Include', 'Business Rule', 'Flow Designer', 'Service Portal Widget', 'Catalog Item'],
  },

  // ── Custom Development ───────────────────────────────────────────────────────
  {
    name: '.NET',
    code: 'dotnet',
    group: 'Custom Development',
    description: '.NET 8+, C# 12, ASP.NET Core, Blazor, MAUI',
    subtext: 'Full-stack custom builds, CI/CD, microservices, cloud-native',
    tech: ['.NET 8+', 'C# 12', 'ASP.NET Core', 'Entity Framework Core', 'MediatR', 'Blazor', 'SignalR', 'xUnit'],
    patterns: [
      { name: 'Clean Architecture', desc: 'Domain → Application → Infrastructure → API layer separation' },
      { name: 'CQRS + MediatR',     desc: 'Command/Query responsibility segregation via mediator pipeline' },
      { name: 'Repository Pattern', desc: 'Data access abstraction over EF Core DbContext' },
      { name: 'Options Pattern',    desc: 'Strongly-typed, validated configuration via IOptions<T>' },
    ],
    folder: `src/\n├── Domain/\n│   ├── Entities/\n│   └── Interfaces/\n├── Application/\n│   ├── Commands/\n│   └── Queries/\n├── Infrastructure/\n│   └── Persistence/\n├── API/\n│   ├── Controllers/\n│   └── Middleware/\n└── Tests/`,
    nfr: [
      'API p95 response time < 200ms',
      'Horizontal scaling via Kubernetes deployments',
      'Health check endpoints (/health, /ready, /live)',
      'Structured logging with Serilog + OpenTelemetry tracing',
    ],
    key_components: ['Domain Entity', 'Application Service', 'EF Core DbContext', 'API Controller', 'Pipeline Behavior'],
  },
  {
    name: 'Python',
    code: 'python',
    group: 'Custom Development',
    description: 'Python 3.12+, FastAPI, async SQLAlchemy, Celery',
    subtext: 'Async-first, FastAPI, Pydantic v2, MLOps ready',
    tech: ['Python 3.12+', 'FastAPI', 'SQLAlchemy 2.0', 'Pydantic v2', 'Celery', 'asyncio', 'Alembic', 'pytest'],
    patterns: [
      { name: 'Async-First',       desc: 'async/await throughout the entire request lifecycle' },
      { name: 'Repository Pattern', desc: 'SQLAlchemy session abstraction in repository classes' },
      { name: 'Service Layer',      desc: 'Business logic between router and repository' },
      { name: 'Factory (Depends)', desc: 'Dependency injection via FastAPI Depends() factory' },
    ],
    folder: `app/\n├── api/\n│   └── routers/\n├── core/\n│   └── config.py\n├── models/\n├── schemas/\n├── services/\n├── repositories/\n├── tasks/\n└── tests/`,
    nfr: [
      'Async I/O for all DB and external HTTP calls',
      'SQLAlchemy connection pool: pool_size=10, max_overflow=20',
      'Celery worker concurrency tuned per CPU count',
      'Pydantic v2 validation — strict mode on API boundaries',
    ],
    key_components: ['FastAPI Router', 'SQLAlchemy Model', 'Pydantic Schema', 'Service Class', 'Celery Task'],
  },
  {
    name: 'Java',
    code: 'java',
    group: 'Custom Development',
    description: 'Java 21+, Spring Boot 3, Jakarta EE, Microservices',
    subtext: 'Enterprise Java, Spring ecosystem, reactive, event-driven',
    tech: ['Java 21+', 'Spring Boot 3', 'Spring Data JPA', 'Hibernate', 'Kafka', 'Resilience4j', 'Maven/Gradle'],
    patterns: [
      { name: 'Layered Architecture', desc: 'Controller → Service → Repository → Database layers' },
      { name: 'Repository Pattern',   desc: 'Spring Data JPA repository abstraction' },
      { name: 'Dependency Injection', desc: 'Spring IoC container — constructor injection preferred' },
      { name: 'Circuit Breaker',      desc: 'Resilience4j fault tolerance for downstream calls' },
    ],
    folder: `src/main/java/com/company/project/\n├── controller/\n├── service/\n├── repository/\n├── model/\n├── dto/\n├── config/\n└── exception/`,
    nfr: [
      'JVM heap tuning: -Xms512m -Xmx2g for production',
      'HikariCP connection pool: maximumPoolSize=20',
      'Circuit breaker: open at 50% failure rate in 10s window',
      'Actuator /health, /metrics, /info endpoints enabled',
    ],
    key_components: ['@RestController', '@Service', '@Repository', 'JPA Entity', '@KafkaListener'],
  },

  // ── Frontend Frameworks ──────────────────────────────────────────────────────
  {
    name: 'React',
    code: 'react',
    group: 'Frontend Frameworks',
    description: 'React 18+, TypeScript, Vite, TanStack Query, Tailwind',
    subtext: 'SPA architecture, state management, design systems, accessibility',
    tech: ['React 18+', 'TypeScript', 'Vite', 'TanStack Query', 'Tailwind CSS', 'Redux Toolkit', 'React Router v7'],
    patterns: [
      { name: 'Component Composition', desc: 'Small reusable UI components composed into features' },
      { name: 'Custom Hooks',          desc: 'Stateful logic encapsulated in useX hooks' },
      { name: 'Feature Folder',        desc: 'Component + hook + test co-located per feature' },
      { name: 'Container / Presenter', desc: 'Data-fetching containers wrapping pure presentational UI' },
    ],
    folder: `src/\n├── components/\n│   ├── ui/\n│   └── layout/\n├── pages/\n├── hooks/\n├── store/\n│   └── slices/\n├── api/\n├── utils/\n└── types/`,
    nfr: [
      'Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms',
      'Code splitting via React.lazy + Suspense boundaries',
      'Bundle size < 300 KB gzipped (initial load)',
      'WCAG 2.1 AA accessibility compliance',
    ],
    key_components: ['Page Component', 'UI Component', 'Custom Hook', 'Redux Slice', 'API Module'],
  },
  {
    name: 'Angular',
    code: 'angular',
    group: 'Frontend Frameworks',
    description: 'Angular 17+, standalone components, NgRx, Signals',
    subtext: 'Enterprise SPA, RxJS, strong typing, Angular Material',
    tech: ['Angular 17+', 'TypeScript', 'RxJS', 'NgRx', 'Angular Material', 'Angular CDK', 'Jest'],
    patterns: [
      { name: 'Standalone Components', desc: 'Module-free, tree-shakeable component architecture' },
      { name: 'Signals',               desc: 'Fine-grained reactivity without Zone.js overhead' },
      { name: 'Facade Pattern',        desc: 'NgRx store hidden behind a service facade' },
      { name: 'Smart/Dumb Components', desc: 'Container (smart) vs presentational (dumb) split' },
    ],
    folder: `src/\n├── app/\n│   ├── core/\n│   │   ├── guards/\n│   │   └── interceptors/\n│   ├── shared/\n│   └── features/\n│       └── [feature]/\n└── environments/`,
    nfr: [
      'Lazy loading all feature routes',
      'OnPush change detection on all components',
      'Initial bundle budget < 500 KB',
      'Angular Universal SSR when SEO is required',
    ],
    key_components: ['Feature Component', 'NgRx Reducer/Effect', 'HTTP Interceptor', 'Shared Module', 'Route Guard'],
  },

  // ── AI & Intelligence ────────────────────────────────────────────────────────
  {
    name: 'Agentic AI',
    code: 'agentic_ai',
    group: 'AI & Intelligence',
    description: 'LangGraph, CrewAI, multi-agent orchestration, tool use, HITL',
    subtext: 'Model lifecycle, agent orchestration, safety guardrails, MCP',
    tech: ['LangGraph', 'CrewAI', 'LangChain', 'Anthropic Claude', 'OpenAI', 'MCP', 'Vector DBs', 'Tool Use'],
    patterns: [
      { name: 'Multi-Agent Orchestration', desc: 'Specialized worker agents coordinated by an orchestrator' },
      { name: 'ReAct Loop',                desc: 'Reason → Act → Observe loop with tool feedback' },
      { name: 'HITL Gates',                desc: 'Human-in-the-loop approval for critical or irreversible actions' },
      { name: 'Plan-and-Execute',          desc: 'Planner agent produces a plan; executor agents carry it out' },
    ],
    folder: `src/\n├── agents/\n│   ├── orchestrator/\n│   └── workers/\n├── tools/\n├── memory/\n│   ├── short_term/\n│   └── long_term/\n├── graphs/\n└── guardrails/`,
    nfr: [
      'Token budget management — hard limit per agent run',
      'Rate limiting with exponential backoff on model APIs',
      'Fallback strategy when primary model is unavailable',
      'Full audit trail — every agent decision logged with rationale',
    ],
    key_components: ['Orchestrator Agent', 'Worker Agents', 'Tool Definitions', 'Memory Store', 'Guardrail Layer'],
  },
  {
    name: 'AI/ML',
    code: 'ai_ml',
    group: 'AI & Intelligence',
    description: 'PyTorch, MLflow, Vertex AI, SageMaker, MLOps',
    subtext: 'Model lifecycle, MLOps, experiment tracking, responsible AI',
    tech: ['PyTorch', 'scikit-learn', 'MLflow', 'Vertex AI', 'SageMaker', 'Hugging Face', 'Feast', 'Great Expectations'],
    patterns: [
      { name: 'Training Pipeline',    desc: 'Data → Preprocessing → Training → Evaluation pipeline' },
      { name: 'Model Registry',       desc: 'Versioned model storage with promotion gates (staging → prod)' },
      { name: 'Feature Store',        desc: 'Centralised feature computation for training and serving' },
      { name: 'Champion/Challenger',  desc: 'A/B testing between model versions with traffic splitting' },
    ],
    folder: `src/\n├── data/\n│   ├── ingestion/\n│   └── validation/\n├── features/\n├── models/\n├── training/\n│   └── pipelines/\n├── evaluation/\n└── serving/`,
    nfr: [
      'Model inference p99 latency < 100ms',
      'Data drift detection (PSI threshold < 0.2)',
      'All experiments tracked in MLflow with reproducible seeds',
      'Model explainability report (SHAP) for each production release',
    ],
    key_components: ['Data Pipeline', 'Feature Engineering', 'Model Training', 'Evaluation Report', 'Serving Endpoint'],
  },
  {
    name: 'Data & AI',
    code: 'data_ai',
    group: 'AI & Intelligence',
    description: 'Lakehouse, dbt, Airflow, BigQuery, Databricks, data governance',
    subtext: 'Data pipelines, medallion architecture, semantic layer, governance',
    tech: ['dbt', 'Apache Airflow', 'BigQuery', 'Databricks', 'Apache Spark', 'Delta Lake', 'Great Expectations'],
    patterns: [
      { name: 'Medallion Architecture', desc: 'Bronze (raw) → Silver (clean) → Gold (aggregated) layers' },
      { name: 'ELT Pattern',            desc: 'Extract-Load then transform inside the warehouse' },
      { name: 'Semantic Layer',         desc: 'dbt metrics as the single source of truth for KPIs' },
      { name: 'Data Contract',          desc: 'Schema and SLA agreements between data producers/consumers' },
    ],
    folder: `dbt/\n├── models/\n│   ├── bronze/\n│   ├── silver/\n│   └── gold/\n├── seeds/\n├── macros/\n└── tests/\nairflow/\n└── dags/`,
    nfr: [
      'Data freshness SLA: Silver < 1hr, Gold < 4hr',
      'Column-level lineage tracking (dbt docs)',
      'Partition pruning and clustering for cost optimization',
      'Data quality score > 98% (Great Expectations suite)',
    ],
    key_components: ['Bronze Pipeline', 'dbt Silver Model', 'dbt Gold Model', 'Airflow DAG', 'Data Quality Test'],
  },

  // ── Cloud Platforms ──────────────────────────────────────────────────────────
  {
    name: 'Azure',
    code: 'azure',
    group: 'Cloud Platforms',
    description: 'Azure Landing Zone, AKS, Azure SQL, Bicep/Terraform',
    subtext: 'IaC, managed services, multi-region, cost optimization',
    tech: ['AKS', 'Azure SQL', 'Azure Functions', 'Logic Apps', 'Bicep', 'Terraform', 'Azure DevOps', 'Monitor'],
    patterns: [
      { name: 'Hub-Spoke Networking', desc: 'Centralised hub VNet with peered spoke VNets per workload' },
      { name: 'Landing Zone',         desc: 'Standardised subscription hierarchy and governance setup' },
      { name: 'Managed Identities',   desc: 'Zero-secret credential management for Azure services' },
      { name: 'Policy-as-Code',       desc: 'Azure Policy for compliance enforcement across subscriptions' },
    ],
    folder: `infra/\n├── modules/\n│   ├── networking/\n│   ├── compute/\n│   └── storage/\n├── environments/\n│   ├── dev/\n│   └── prod/\n└── pipelines/\n    └── azure-pipelines.yml`,
    nfr: [
      '99.9% SLA with AKS + Azure SQL active-geo-replication',
      'Geo-redundant storage (GRS) for all critical data',
      'Azure Cost Management budgets with alert thresholds',
      'Azure Monitor + Application Insights for full observability',
    ],
    key_components: ['AKS Cluster', 'Azure SQL', 'Key Vault', 'Application Gateway', 'Azure DevOps Pipeline'],
  },
  {
    name: 'AWS',
    code: 'aws',
    group: 'Cloud Platforms',
    description: 'Control Tower, ECS/Fargate, Lambda, CDK, Well-Architected',
    subtext: 'IaC, managed services, multi-region, cost optimization',
    tech: ['ECS/Fargate', 'Lambda', 'AWS CDK', 'RDS Aurora', 'EventBridge', 'API Gateway', 'CloudWatch', 'WAF'],
    patterns: [
      { name: 'Event-Driven',       desc: 'EventBridge for loosely coupled service-to-service communication' },
      { name: 'Serverless-First',   desc: 'Lambda + API Gateway for stateless, scalable workloads' },
      { name: 'Multi-AZ',           desc: 'Active-active deployments across availability zones' },
      { name: 'CDK L2/L3 Constructs', desc: 'Reusable, opinionated IaC patterns via CDK constructs' },
    ],
    folder: `cdk/\n├── lib/\n│   ├── stacks/\n│   └── constructs/\n├── bin/\nlambda/\n│   └── functions/\nsrc/\n└── .github/\n    └── workflows/`,
    nfr: [
      'Well-Architected Framework review before each major release',
      'Auto-scaling: scale out when CPU > 70% for 2 minutes',
      'Cost optimization: Savings Plans + Spot for non-critical workloads',
      'AWS Config rules for continuous compliance monitoring',
    ],
    key_components: ['ECS Service', 'Lambda Function', 'CDK Stack', 'RDS Aurora Cluster', 'CloudWatch Dashboard'],
  },
  {
    name: 'GCP',
    code: 'gcp',
    group: 'Cloud Platforms',
    description: 'Cloud Run, GKE, BigQuery, Vertex AI, Terraform',
    subtext: 'AI/ML strength, BigQuery, Vertex AI, serverless',
    tech: ['Cloud Run', 'GKE', 'BigQuery', 'Vertex AI', 'Terraform', 'Pub/Sub', 'Cloud Build', 'Artifact Registry'],
    patterns: [
      { name: 'Serverless-Preferred',  desc: 'Cloud Run for containerised stateless workloads with zero-ops' },
      { name: 'VPC Service Controls',  desc: 'Data exfiltration prevention around sensitive datasets' },
      { name: 'IAM Least Privilege',  desc: 'Workload Identity Federation — no long-lived service account keys' },
      { name: 'GitOps',               desc: 'Cloud Build + Config Connector for declarative cluster state' },
    ],
    folder: `terraform/\n├── modules/\n│   ├── gke/\n│   ├── cloudrun/\n│   └── bigquery/\n├── environments/\n│   ├── dev/\n│   └── prod/\nsrc/\n└── cloudbuild.yaml`,
    nfr: [
      'Global load balancing — p99 latency < 100ms worldwide',
      'Sustained use discounts on compute (> 25% usage)',
      'SLO monitoring via Cloud Monitoring error budget',
      'BigQuery slot reservation for production query isolation',
    ],
    key_components: ['Cloud Run Service', 'GKE Workload', 'BigQuery Dataset', 'Pub/Sub Topic', 'Vertex AI Endpoint'],
  },
]

export function getGroupMeta(groupLabel) {
  return SERVICE_LINE_GROUPS.find((g) => g.label === groupLabel) || {}
}

export function getStandardByCode(code) {
  return SERVICE_LINE_STANDARDS.find((s) => s.code === code)
}

export function filterByProject(projectServiceLineStr) {
  if (!projectServiceLineStr) return []
  const codes = projectServiceLineStr.split(',').map((s) => s.trim().toLowerCase())
  return SERVICE_LINE_STANDARDS.filter((s) => codes.includes(s.code))
}
