export const PLATFORM_COMBINATIONS = [
  {
    id: 'C01',
    service_lines: ['salesforce', 'aws'],
    use_case: 'Enterprise CRM with cloud-native backend',
    architecture_style: 'Event-Driven SaaS',
    integration_patterns: [
      'Salesforce Platform Events → AWS EventBridge for real-time data sync',
      'AWS Lambda functions triggered by Salesforce webhooks',
      'S3 + AWS Glue for bulk Salesforce data export and analytics',
      'AWS API Gateway as reverse proxy for custom Apex callouts',
    ],
    typical_use: 'Large enterprises running Salesforce as CRM with custom AWS microservices handling backend processing, analytics, and integrations.',
  },
  {
    id: 'C02',
    service_lines: ['salesforce', 'dotnet', 'azure'],
    use_case: 'CRM with Microsoft-ecosystem custom apps',
    architecture_style: 'Hybrid SaaS + PaaS',
    integration_patterns: [
      'Salesforce REST/SOAP APIs consumed by ASP.NET Core services',
      'Azure Service Bus as message broker between Salesforce and .NET',
      'Azure AD SSO federated with Salesforce Identity',
      'Power BI connected to Salesforce Analytics and Azure SQL',
    ],
    typical_use: 'Microsoft-stack enterprises extending Salesforce CRM with .NET microservices hosted on Azure, leveraging Azure DevOps for CI/CD.',
  },
  {
    id: 'C03',
    service_lines: ['sap', 'azure', 'dotnet'],
    use_case: 'ERP modernization with Azure cloud',
    architecture_style: 'Cloud-First ERP Extension',
    integration_patterns: [
      'SAP BTP side-by-side extensions deployed on Azure Container Apps',
      'SAP OData APIs consumed via Azure API Management',
      'Azure Data Factory for SAP to Azure SQL replication',
      '.NET microservices bridging SAP and modern web frontends',
    ],
    typical_use: 'Enterprises modernizing SAP landscapes using Azure as the extension and integration platform, with .NET for custom business logic.',
  },
  {
    id: 'C04',
    service_lines: ['sap', 'aws', 'java'],
    use_case: 'ERP with AWS infrastructure',
    architecture_style: 'Microservices + ERP Core',
    integration_patterns: [
      'SAP RFC/BAPI calls via Java JCo library hosted on ECS',
      'AWS SQS queues for async SAP event processing',
      'Spring Boot microservices exposing SAP data via REST APIs',
      'AWS RDS Aurora for SAP data replica and reporting',
    ],
    typical_use: 'Manufacturing and logistics companies running SAP on AWS with Java microservices handling custom extensions, reporting, and third-party integrations.',
  },
  {
    id: 'C05',
    service_lines: ['servicenow', 'azure', 'dotnet'],
    use_case: 'ITSM with enterprise app integration',
    architecture_style: 'Process-Driven Integration',
    integration_patterns: [
      'ServiceNow REST APIs called by .NET services for ticket automation',
      'Azure Logic Apps orchestrating ServiceNow workflows',
      'ServiceNow IntegrationHub spokes connected to Azure AD and Teams',
      'Azure Monitor alerts auto-creating ServiceNow incidents',
    ],
    typical_use: 'Enterprises using ServiceNow as ITSM backbone with Azure-hosted .NET applications feeding incidents, change requests, and CMDB updates.',
  },
  {
    id: 'C06',
    service_lines: ['netsuite', 'aws', 'python'],
    use_case: 'Mid-market ERP with custom analytics',
    architecture_style: 'SaaS + Serverless Analytics',
    integration_patterns: [
      'NetSuite SuiteScript RESTlets called from Python Lambda functions',
      'AWS Glue + Python for NetSuite data extraction and transformation',
      'FastAPI microservices extending NetSuite with custom workflows',
      'Amazon Redshift as analytics warehouse fed from NetSuite exports',
    ],
    typical_use: 'Mid-market companies using NetSuite as ERP with custom Python analytics pipelines and AWS-hosted extensions for niche business processes.',
  },
  {
    id: 'C07',
    service_lines: ['react', 'python', 'aws'],
    use_case: 'Full-stack custom SaaS application',
    architecture_style: 'Modern SaaS (Serverless + SPA)',
    integration_patterns: [
      'React SPA → FastAPI backend via AWS API Gateway',
      'Celery workers on ECS Fargate for async task processing',
      'AWS S3 + CloudFront for React static asset delivery',
      'AWS RDS (PostgreSQL) with SQLAlchemy ORM in FastAPI',
    ],
    typical_use: 'Greenfield SaaS products built with React frontend, Python/FastAPI backend, deployed fully on AWS with managed services for scalability.',
  },
  {
    id: 'C08',
    service_lines: ['react', 'dotnet', 'azure'],
    use_case: 'Full-stack Microsoft-ecosystem app',
    architecture_style: 'Modern Web + Cloud PaaS',
    integration_patterns: [
      'React SPA → ASP.NET Core Web API on Azure App Service',
      'Azure AD B2C for React authentication via MSAL',
      'SignalR on Azure for real-time React UI updates',
      'Azure SQL + EF Core as the data layer',
    ],
    typical_use: 'Enterprise applications built on the Microsoft stack — React frontend with .NET API, deployed on Azure with full Azure DevOps CI/CD.',
  },
  {
    id: 'C09',
    service_lines: ['angular', 'java', 'gcp'],
    use_case: 'Enterprise app with Google Cloud AI',
    architecture_style: 'Enterprise SPA + Cloud-Native Java',
    integration_patterns: [
      'Angular SPA → Spring Boot REST API on GKE',
      'Google Cloud SQL (PostgreSQL) with Spring Data JPA',
      'Vertex AI APIs consumed by Spring Boot services',
      'Cloud Pub/Sub for event-driven Angular real-time features',
    ],
    typical_use: 'Enterprise portals leveraging Angular for complex UI, Spring Boot for business logic, and GCP\'s Vertex AI for intelligent features.',
  },
  {
    id: 'C10',
    service_lines: ['react', 'java', 'aws'],
    use_case: 'Microservices-based enterprise platform',
    architecture_style: 'Microservices + SPA',
    integration_patterns: [
      'React SPA → AWS API Gateway → Spring Boot microservices on ECS',
      'Kafka on AWS MSK for inter-service event streaming',
      'Spring Cloud Gateway as internal API gateway',
      'AWS X-Ray for distributed tracing across Java services',
    ],
    typical_use: 'Large-scale enterprise platforms with React frontend consuming multiple Spring Boot microservices deployed on AWS ECS with Kafka for async communication.',
  },
  {
    id: 'C11',
    service_lines: ['agentic_ai', 'python', 'azure'],
    use_case: 'AI agent platform with Azure AI services',
    architecture_style: 'Agentic + Cloud AI',
    integration_patterns: [
      'LangGraph orchestrator running on Azure Container Apps',
      'Azure OpenAI Service as LLM provider for agents',
      'Azure Cognitive Search as vector store for RAG',
      'FastAPI backend exposing agent APIs to frontend consumers',
    ],
    typical_use: 'Intelligent automation platforms where LangGraph/CrewAI agents use Azure OpenAI and Azure Cognitive Search, orchestrated by a Python FastAPI backend.',
  },
  {
    id: 'C12',
    service_lines: ['ai_ml', 'python', 'gcp'],
    use_case: 'ML platform with GCP AI infrastructure',
    architecture_style: 'MLOps + Vertex AI',
    integration_patterns: [
      'Vertex AI Pipelines executing Python training jobs',
      'MLflow on Cloud Run for experiment tracking',
      'BigQuery ML for in-warehouse model scoring',
      'Vertex AI Endpoints for online serving with auto-scaling',
    ],
    typical_use: 'Teams building end-to-end ML platforms using Vertex AI for training and serving, with Python pipelines, MLflow tracking, and BigQuery for feature serving.',
  },
  {
    id: 'C13',
    service_lines: ['data_ai', 'python', 'aws'],
    use_case: 'Data lakehouse with AWS analytics',
    architecture_style: 'Medallion Lakehouse',
    integration_patterns: [
      'Python Airflow DAGs on MWAA orchestrating S3-based ELT',
      'AWS Glue + PySpark for Bronze → Silver → Gold transformations',
      'dbt Core running on AWS Fargate for SQL-based transformations',
      'Amazon Athena + QuickSight for Gold layer analytics',
    ],
    typical_use: 'Data engineering teams building scalable lakehouses on AWS with Airflow orchestration, Glue/Spark for heavy transforms, and dbt for semantic models.',
  },
  {
    id: 'C14',
    service_lines: ['salesforce', 'servicenow', 'azure'],
    use_case: 'Unified CRM and ITSM enterprise platform',
    architecture_style: 'SaaS-to-SaaS Integration Hub',
    integration_patterns: [
      'Azure Integration Services (Logic Apps + API Management) as middleware',
      'Salesforce Cases → ServiceNow Incidents bidirectional sync',
      'Azure AD as identity provider for both Salesforce and ServiceNow',
      'Azure Service Bus decoupling Salesforce events from ServiceNow workflows',
    ],
    typical_use: 'Large enterprises running both Salesforce (CRM) and ServiceNow (ITSM) needing unified customer + service data with Azure as the integration backbone.',
  },
  {
    id: 'C15',
    service_lines: ['react', 'agentic_ai', 'python'],
    use_case: 'Intelligent full-stack AI application',
    architecture_style: 'AI-Native SPA',
    integration_patterns: [
      'React SPA consuming FastAPI streaming endpoints (SSE) for agent responses',
      'LangGraph agents behind FastAPI with async task queuing via Celery',
      'WebSocket support in FastAPI for real-time agent thought streaming',
      'React state management (Redux) tracking multi-step agent progress',
    ],
    typical_use: 'AI-powered products like copilots, intelligent assistants, and workflow automation tools built with React frontend and Python agentic backends.',
  },
  {
    id: 'C16',
    service_lines: ['sap', 'servicenow', 'azure'],
    use_case: 'SAP-ServiceNow enterprise process automation',
    architecture_style: 'ERP + ITSM Process Bridge',
    integration_patterns: [
      'SAP maintenance orders auto-creating ServiceNow change requests via Azure Logic Apps',
      'ServiceNow CMDB synced with SAP asset management data',
      'Azure API Management as unified API layer for both SAP and ServiceNow',
      'SAP BTP workflows triggering ServiceNow approval flows',
    ],
    typical_use: 'Manufacturing and asset-heavy industries automating the bridge between SAP ERP processes and ServiceNow ITSM workflows via Azure middleware.',
  },
  {
    id: 'C17',
    service_lines: ['oracle', 'java', 'aws'],
    use_case: 'Oracle cloud-native modernization',
    architecture_style: 'ERP Modernization + Microservices',
    integration_patterns: [
      'Oracle REST Data Services (ORDS) consumed by Spring Boot on ECS',
      'OIC replaced by AWS Step Functions for custom orchestration',
      'Spring Boot microservices wrapping Oracle APEX APIs',
      'AWS DMS for Oracle DB migration to Amazon Aurora',
    ],
    typical_use: 'Enterprises modernizing Oracle ERP/APEX landscapes by wrapping them with Java Spring Boot microservices on AWS, incrementally migrating to cloud-native.',
  },
  {
    id: 'C18',
    service_lines: ['netsuite', 'dotnet', 'azure'],
    use_case: 'Mid-market ERP with Azure integration layer',
    architecture_style: 'ERP + iPaaS',
    integration_patterns: [
      'NetSuite SuiteTalk SOAP/REST APIs consumed by .NET Azure Functions',
      'Azure Logic Apps for automated NetSuite record creation workflows',
      'Azure Service Bus queuing NetSuite webhook events for .NET processors',
      'Azure SQL as operational data store synced from NetSuite',
    ],
    typical_use: 'Mid-market companies on NetSuite integrating with Microsoft-ecosystem tools — Azure for hosting, .NET for custom logic, and Power Platform for business users.',
  },
  {
    id: 'C19',
    service_lines: ['angular', 'java', 'azure'],
    use_case: 'Enterprise portal with Azure backend',
    architecture_style: 'Enterprise SPA + Cloud PaaS',
    integration_patterns: [
      'Angular SPA authenticating via Azure AD (MSAL for Angular)',
      'Spring Boot APIs on Azure Kubernetes Service (AKS)',
      'Azure Service Bus for async Java service communication',
      'Azure Application Gateway with WAF in front of AKS ingress',
    ],
    typical_use: 'Enterprise internal portals and B2B applications using Angular for complex UI, Spring Boot for business logic, with Azure handling identity, hosting, and security.',
  },
  {
    id: 'C20',
    service_lines: ['data_ai', 'agentic_ai', 'gcp'],
    use_case: 'AI-powered analytics platform',
    architecture_style: 'Data + AI Convergence',
    integration_patterns: [
      'BigQuery as the data layer powering Vertex AI model training',
      'LangGraph agents querying BigQuery via Google Cloud APIs for insights',
      'Vertex AI Embeddings + Vector Search for semantic data retrieval',
      'Cloud Run hosting Python agent APIs consuming GCP AI services',
    ],
    typical_use: 'Next-gen analytics platforms combining a GCP data lakehouse with agentic AI — agents that can reason over business data, generate insights, and trigger workflows.',
  },
]

export function findMatchingCombos(projectServiceLineStr) {
  if (!projectServiceLineStr) return []
  const codes = projectServiceLineStr.split(',').map((s) => s.trim().toLowerCase())
  return PLATFORM_COMBINATIONS.filter((combo) =>
    combo.service_lines.some((sl) => codes.includes(sl))
  ).sort((a, b) => {
    const aMatches = a.service_lines.filter((sl) => codes.includes(sl)).length
    const bMatches = b.service_lines.filter((sl) => codes.includes(sl)).length
    return bMatches - aMatches
  })
}
