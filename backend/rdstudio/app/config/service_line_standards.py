"""
Service line design standards — Python mirror of the frontend M15 data.
Used by the HLD orchestrator to inject service-line-specific context into LLM prompts.
"""

SERVICE_LINE_STANDARDS: dict[str, dict] = {
    "salesforce": {
        "tech": ["Apex", "LWC", "Flow", "SOQL", "MuleSoft", "REST/SOAP APIs"],
        "patterns": ["Trigger Framework", "Service Layer", "Selector Pattern", "Unit of Work"],
        "folder": "force-app/main/default/{classes, lwc, triggers, flows, objects, permissionsets}",
        "nfr": [
            "Governor limits: SOQL < 100, DML < 150 per transaction",
            "Bulkification — all code must handle 200-record batches",
            "Async processing via Queueable/Batch Apex for heavy jobs",
        ],
    },
    "netsuite": {
        "tech": ["SuiteScript 2.x", "SuiteFlow", "SuiteQL", "RESTlets", "SuiteTalk SOAP"],
        "patterns": ["Script Deployment", "Map/Reduce", "Suitelet MVC", "Scheduled Script"],
        "folder": "src/{FileCabinet/SuiteScripts/{UserEvent, ScheduledScripts, RESTlets}, Objects, Translations}",
        "nfr": [
            "Script governance limit compliance (10,000 units per execution)",
            "Async Map/Reduce for bulk data operations",
        ],
    },
    "sap": {
        "tech": ["ABAP", "CAP (Node.js/Java)", "SAP Fiori", "BTP", "OData v4", "CDS Views", "RAP"],
        "patterns": ["MVC (Fiori)", "CDS View-Based", "OData Service Layer", "BTP Side-by-Side Extension"],
        "folder": "app/{webapp/{view, controller, model, i18n}, srv, db}",
        "nfr": [
            "RFC/BAPI call optimization — minimize round-trips",
            "Fiori initial load < 3s",
            "ABAP memory limits compliance",
        ],
    },
    "oracle": {
        "tech": ["PL/SQL", "Oracle APEX", "OIC", "VBCS", "ORDS REST", "JET Framework", "FBDI"],
        "patterns": ["MVC (APEX)", "API-First (ORDS)", "FBDI Pattern", "OIC Integration Flow"],
        "folder": "src/{apex/{pages, plugins}, plsql/{packages, procedures}, ords/modules, integrations}",
        "nfr": [
            "PL/SQL bind variables — no dynamic SQL without them",
            "OIC error handling with DLQ and retry policies",
        ],
    },
    "servicenow": {
        "tech": ["Flow Designer", "Script Includes", "UI Policies", "Client Scripts", "REST API", "ATF", "IntegrationHub"],
        "patterns": ["Scoped Application", "CMDB-Centric", "ITSM Process Flow", "IntegrationHub Spoke"],
        "folder": "src/{Script Includes, Business Rules, Client Scripts, UI Policies, Widgets, Flow Actions}",
        "nfr": [
            "Memory limit per script execution (< 512 MB)",
            "ATF test coverage > 80%",
        ],
    },
    "dotnet": {
        "tech": [".NET 8+", "C# 12", "ASP.NET Core", "Entity Framework Core", "MediatR", "SignalR"],
        "patterns": ["Clean Architecture", "CQRS + MediatR", "Repository Pattern", "Options Pattern"],
        "folder": "src/{Domain/{Entities, Interfaces}, Application/{Commands, Queries}, Infrastructure/Persistence, API/{Controllers, Middleware}, Tests}",
        "nfr": [
            "API p95 response time < 200ms",
            "Horizontal scaling via Kubernetes",
            "Health check endpoints (/health, /ready, /live)",
            "Structured logging with Serilog + OpenTelemetry",
        ],
    },
    "python": {
        "tech": ["Python 3.12+", "FastAPI", "SQLAlchemy 2.0", "Pydantic v2", "Celery", "asyncio", "Alembic"],
        "patterns": ["Async-First", "Repository Pattern", "Service Layer", "Factory (Depends)"],
        "folder": "app/{api/routers, core, models, schemas, services, repositories, tasks, tests}",
        "nfr": [
            "Async I/O for all DB and external HTTP calls",
            "SQLAlchemy connection pool: pool_size=10, max_overflow=20",
            "Celery worker concurrency tuned per CPU count",
        ],
    },
    "java": {
        "tech": ["Java 21+", "Spring Boot 3", "Spring Data JPA", "Hibernate", "Kafka", "Resilience4j"],
        "patterns": ["Layered Architecture", "Repository Pattern", "Dependency Injection", "Circuit Breaker"],
        "folder": "src/main/java/com/company/project/{controller, service, repository, model, dto, config, exception}",
        "nfr": [
            "JVM heap tuning: -Xms512m -Xmx2g",
            "HikariCP connection pool: maximumPoolSize=20",
            "Circuit breaker: open at 50% failure rate in 10s window",
        ],
    },
    "react": {
        "tech": ["React 18+", "TypeScript", "Vite", "TanStack Query", "Tailwind CSS", "Redux Toolkit"],
        "patterns": ["Component Composition", "Custom Hooks", "Feature Folder", "Container/Presenter"],
        "folder": "src/{components/{ui, layout}, pages, hooks, store/slices, api, utils, types}",
        "nfr": [
            "Core Web Vitals: LCP < 2.5s, CLS < 0.1",
            "Code splitting via React.lazy + Suspense",
            "Bundle size < 300 KB gzipped",
            "WCAG 2.1 AA accessibility compliance",
        ],
    },
    "angular": {
        "tech": ["Angular 17+", "TypeScript", "RxJS", "NgRx", "Angular Material", "Angular CDK"],
        "patterns": ["Standalone Components", "Signals", "Facade Pattern", "Smart/Dumb Components"],
        "folder": "src/app/{core/{guards, interceptors}, shared, features/[feature]}, environments",
        "nfr": [
            "Lazy loading all feature routes",
            "OnPush change detection on all components",
            "Initial bundle budget < 500 KB",
        ],
    },
    "agentic_ai": {
        "tech": ["LangGraph", "CrewAI", "LangChain", "Anthropic Claude", "OpenAI", "MCP", "Vector DBs"],
        "patterns": ["Multi-Agent Orchestration", "ReAct Loop", "HITL Gates", "Plan-and-Execute"],
        "folder": "src/{agents/{orchestrator, workers}, tools, memory/{short_term, long_term}, graphs, guardrails}",
        "nfr": [
            "Token budget management — hard limit per agent run",
            "Rate limiting with exponential backoff on model APIs",
            "Full audit trail — every agent decision logged with rationale",
        ],
    },
    "ai_ml": {
        "tech": ["PyTorch", "scikit-learn", "MLflow", "Vertex AI", "SageMaker", "Hugging Face"],
        "patterns": ["Training Pipeline", "Model Registry", "Feature Store", "Champion/Challenger"],
        "folder": "src/{data/{ingestion, validation}, features, models, training/pipelines, evaluation, serving}",
        "nfr": [
            "Model inference p99 latency < 100ms",
            "Data drift detection (PSI threshold < 0.2)",
            "All experiments tracked in MLflow",
        ],
    },
    "data_ai": {
        "tech": ["dbt", "Apache Airflow", "BigQuery", "Databricks", "Apache Spark", "Delta Lake"],
        "patterns": ["Medallion Architecture", "ELT Pattern", "Semantic Layer", "Data Contract"],
        "folder": "dbt/{models/{bronze, silver, gold}, seeds, macros, tests}, airflow/dags",
        "nfr": [
            "Data freshness SLA: Silver < 1hr, Gold < 4hr",
            "Column-level lineage tracking",
            "Data quality score > 98%",
        ],
    },
    "azure": {
        "tech": ["AKS", "Azure SQL", "Azure Functions", "Logic Apps", "Bicep", "Terraform", "Azure DevOps"],
        "patterns": ["Hub-Spoke Networking", "Landing Zone", "Managed Identities", "Policy-as-Code"],
        "folder": "infra/{modules/{networking, compute, storage}, environments/{dev, prod}}, pipelines",
        "nfr": [
            "99.9% SLA with AKS + Azure SQL active-geo-replication",
            "Azure Monitor + Application Insights for full observability",
        ],
    },
    "aws": {
        "tech": ["ECS/Fargate", "Lambda", "AWS CDK", "RDS Aurora", "EventBridge", "API Gateway", "CloudWatch"],
        "patterns": ["Event-Driven", "Serverless-First", "Multi-AZ", "CDK L2/L3 Constructs"],
        "folder": "cdk/{lib/{stacks, constructs}, bin}, lambda/functions, src, .github/workflows",
        "nfr": [
            "Well-Architected Framework review before each major release",
            "Auto-scaling: scale out when CPU > 70% for 2 minutes",
        ],
    },
    "gcp": {
        "tech": ["Cloud Run", "GKE", "BigQuery", "Vertex AI", "Terraform", "Pub/Sub", "Cloud Build"],
        "patterns": ["Serverless-Preferred", "VPC Service Controls", "IAM Least Privilege", "GitOps"],
        "folder": "terraform/{modules/{gke, cloudrun, bigquery}, environments/{dev, prod}}, src, cloudbuild.yaml",
        "nfr": [
            "Global load balancing — p99 latency < 100ms worldwide",
            "SLO monitoring via Cloud Monitoring error budget",
        ],
    },
}


def get_standards_for_project(service_line_str: str) -> dict[str, dict]:
    """Return standards dict for all service lines in the project."""
    if not service_line_str:
        return {}
    codes = [s.strip().lower() for s in service_line_str.split(",")]
    return {code: SERVICE_LINE_STANDARDS[code] for code in codes if code in SERVICE_LINE_STANDARDS}


def build_standards_context(service_line_str: str) -> str:
    """Build a text block of service-line standards to inject into LLM prompts."""
    standards = get_standards_for_project(service_line_str)
    if not standards:
        return "No specific service line standards identified."

    parts = []
    for code, data in standards.items():
        tech_str     = ", ".join(data["tech"])
        patterns_str = ", ".join(data["patterns"])
        nfr_str      = "\n  - ".join(data["nfr"])
        parts.append(
            f"### {code.upper()} Standards\n"
            f"Tech Stack: {tech_str}\n"
            f"Design Patterns: {patterns_str}\n"
            f"Folder: {data['folder']}\n"
            f"NFR Baselines:\n  - {nfr_str}"
        )
    return "\n\n".join(parts)
