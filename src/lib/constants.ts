// Project statuses
export const PROJECT_STATUSES = ['draft', 'open', 'in_progress', 'completed', 'cancelled'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: 'bg-muted/20 text-muted',
  open: 'bg-success/20 text-success',
  in_progress: 'bg-accent/20 text-accent',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-error/20 text-error',
};

// Position statuses
export const POSITION_STATUSES = ['open', 'filled', 'closed'] as const;
export type PositionStatus = typeof POSITION_STATUSES[number];

// Pay types
export const PAY_TYPES = ['fixed', 'hourly'] as const;
export type PayType = typeof PAY_TYPES[number];

// Visibility options
export const VISIBILITY_OPTIONS = ['public', 'private', 'unlisted'] as const;
export type ProjectVisibility = typeof VISIBILITY_OPTIONS[number];

// Payment statuses
export const PAYMENT_STATUSES = ['unfunded', 'funded', 'in_progress', 'completed'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unfunded: 'Unfunded',
  funded: 'Funded',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unfunded: 'bg-muted/20 text-muted',
  funded: 'bg-accent/20 text-accent',
  in_progress: 'bg-warning/20 text-warning',
  completed: 'bg-success/20 text-success',
};

// Approval statuses
export const APPROVAL_STATUSES = ['pending_review', 'approved', 'rejected', 'revision_requested'] as const;
export type ApprovalStatus = typeof APPROVAL_STATUSES[number];

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_requested: 'Revision Requested',
};

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending_review: 'bg-warning/20 text-warning',
  approved: 'bg-success/20 text-success',
  rejected: 'bg-error/20 text-error',
  revision_requested: 'bg-accent/20 text-accent',
};

// Commission rate
export const COMMISSION_RATE = 0.10;

// Escrow statuses
export const ESCROW_STATUSES = ['unfunded', 'pending', 'funded', 'partially_released', 'released', 'refunded'] as const;
export type EscrowStatus = typeof ESCROW_STATUSES[number];

export const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  unfunded: 'Unfunded',
  pending: 'Pending',
  funded: 'Funded',
  partially_released: 'Partially Released',
  released: 'Released',
  refunded: 'Refunded',
};

export const ESCROW_STATUS_COLORS: Record<EscrowStatus, string> = {
  unfunded: 'bg-muted/20 text-muted',
  pending: 'bg-warning/20 text-warning',
  funded: 'bg-success/20 text-success',
  partially_released: 'bg-accent/20 text-accent',
  released: 'bg-success/20 text-success',
  refunded: 'bg-error/20 text-error',
};

// Payment rails
export const PAYMENT_RAILS = ['ledger', 'stripe', 'x402'] as const;
export type PaymentRail = typeof PAYMENT_RAILS[number];

export const PAYMENT_RAIL_LABELS: Record<PaymentRail, string> = {
  ledger: 'Internal Ledger',
  stripe: 'Stripe',
  x402: 'x402 (USDC)',
};

// Webhook events
export const WEBHOOK_EVENTS = [
  'position_posted',
  'application_accepted',
  'application_rejected',
  'ticket_assigned',
  'ticket_status_changed',
  'message_received',
  'deliverable_approved',
  'deliverable_rejected',
  'review_submitted',
  'ci_check_completed',
  'pr_review_submitted',
  'payout_settled',
  'escrow_funded',
  'x402_payment_received',
] as const;
export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

// Application statuses
export const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

// Ticket statuses
export const TICKET_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const;
export type TicketStatus = typeof TICKET_STATUSES[number];

// Valid ticket status transitions (state machine)
export const VALID_TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  todo: ['in_progress', 'cancelled'],
  in_progress: ['in_review', 'todo', 'cancelled'],
  in_review: ['done', 'in_progress', 'cancelled'],
  done: ['in_review'],           // reopen for revision
  cancelled: ['todo'],           // reopen
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

// Ticket priorities
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = typeof TICKET_PRIORITIES[number];

export const TICKET_PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-muted/20 text-muted',
  medium: 'bg-accent/20 text-accent',
  high: 'bg-warning/20 text-warning',
  urgent: 'bg-error/20 text-error',
};

// Knowledge categories
export const KNOWLEDGE_CATEGORIES = ['architecture', 'decisions', 'patterns', 'context', 'general'] as const;
export type KnowledgeCategory = typeof KNOWLEDGE_CATEGORIES[number];

// Role levels (hierarchy)
export const ROLE_LEVELS = ['project_manager', 'lead', 'worker'] as const;
export type RoleLevel = typeof ROLE_LEVELS[number];

export const ROLE_LEVEL_LABELS: Record<RoleLevel, string> = {
  project_manager: 'Project Manager',
  lead: 'Lead',
  worker: 'Worker',
};

export const ROLE_LEVEL_COLORS: Record<RoleLevel, string> = {
  project_manager: 'bg-accent/20 text-accent',
  lead: 'bg-warning/20 text-warning',
  worker: 'bg-muted/20 text-muted',
};

// Goal statuses
export const GOAL_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type GoalStatus = typeof GOAL_STATUSES[number];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const GOAL_STATUS_COLORS: Record<GoalStatus, string> = {
  pending: 'bg-muted/20 text-muted',
  in_progress: 'bg-accent/20 text-accent',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-error/20 text-error',
};

// Ticket types
export const TICKET_TYPES = ['epic', 'story', 'task', 'bug', 'spike'] as const;
export type TicketTypeConst = typeof TICKET_TYPES[number];

export const TICKET_TYPE_LABELS: Record<TicketTypeConst, string> = {
  epic: 'Epic',
  story: 'Story',
  task: 'Task',
  bug: 'Bug',
  spike: 'Spike',
};

export const TICKET_TYPE_COLORS: Record<TicketTypeConst, string> = {
  epic: 'bg-accent/20 text-accent',
  story: 'bg-success/20 text-success',
  task: 'bg-muted/20 text-muted',
  bug: 'bg-error/20 text-error',
  spike: 'bg-warning/20 text-warning',
};

// Knowledge importance
export const KNOWLEDGE_IMPORTANCE = ['pinned', 'high', 'normal', 'low'] as const;

// LLM providers for agent registry
export const LLM_PROVIDERS = ['openai', 'anthropic', 'google', 'meta', 'mistral', 'open-source', 'custom'] as const;

export const LLM_PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  meta: 'Meta',
  mistral: 'Mistral',
  'open-source': 'Open Source',
  custom: 'Custom',
};

// Common capabilities (human-facing — what the agent can DO)
export const AGENT_CAPABILITIES = [
  'frontend', 'backend', 'fullstack', 'devops', 'database',
  'api', 'testing', 'design', 'pm', 'documentation',
  'react', 'nextjs', 'python', 'typescript', 'rust', 'go',
  'aws', 'gcp', 'docker', 'kubernetes',
  'ml', 'data-science', 'security', 'mobile', 'ios', 'android',
] as const;

// Agent tool capabilities (what APIs/tools the agent can call)
export const AGENT_TOOLS = [
  'code_execution', 'web_browse', 'file_system', 'github_api',
  'api_calls', 'image_gen', 'web_search', 'database_query',
  'shell_access', 'docker_run',
] as const;

export const AGENT_TOOL_LABELS: Record<string, string> = {
  code_execution: 'Code Execution',
  web_browse: 'Web Browse',
  file_system: 'File System',
  github_api: 'GitHub API',
  api_calls: 'API Calls',
  image_gen: 'Image Gen',
  web_search: 'Web Search',
  database_query: 'DB Query',
  shell_access: 'Shell Access',
  docker_run: 'Docker',
};

// Autonomy levels
export const AUTONOMY_LEVELS = ['full', 'semi', 'supervised'] as const;

export const AUTONOMY_LABELS: Record<string, string> = {
  full: 'Fully Autonomous',
  semi: 'Semi-Autonomous',
  supervised: 'Supervised',
};

export const AUTONOMY_DESCRIPTIONS: Record<string, string> = {
  full: 'No human approval needed — agent works independently',
  semi: 'Checkpoints at key decisions — human reviews milestones',
  supervised: 'Human approves each action before execution',
};

// Agent context templates — role-specific system prompts
export const AGENT_CONTEXT_TEMPLATES = {
  project_manager: `You are the Project Manager for "{project_name}".

## Vision
{description}

## Your Mandate
You own the project plan, the team structure, and delivery. You are the bridge between the human owner's vision and the agent team's execution.

## Responsibilities
1. Break the vision into milestones, epics, and actionable tickets
2. Design the org chart — decide what leads and workers the project needs
3. Create positions and post them for agent hiring
4. Write clear ticket specs with acceptance criteria
5. Assign tickets to the right team members based on their skills
6. Run standups — check progress, unblock agents, reprioritize
7. Track budget burn and timeline, flag risks early
8. Report to the project owner with status updates and decisions needed

## How You Work
- Tickets: Create epics for major features, break into stories/tasks for individuals
- Chat: Use #general for announcements, create topic channels for workstreams
- Memory: Log architecture decisions, project conventions, and team agreements
- Positions: Start with leads for each domain, then workers under each lead

## Context
- Project ID: {project_id}
- Owner: {owner_name}
- Budget: {budget}
- Deadline: {deadline}
- GitHub: {github_repo}`,

  lead: `You are the {position_title} for "{project_name}".

## Your Domain
{lead_description}

## Reports To
{reports_to}

{lead_responsibilities}

## How You Work
- Own your domain's technical direction and quality bar
- Break PM-assigned epics into implementable stories and tasks
- Assign work to your team members based on their strengths
- Review deliverables before marking tickets as done
- Write knowledge entries for architecture decisions in your domain
- Flag blockers and risks to the PM immediately
- Coordinate with other leads when your work has cross-domain dependencies`,

  worker: `You are a {position_title} for "{project_name}".

## Reports To
{reports_to}

## Your Role
{worker_description}

{worker_responsibilities}

## How You Work
{worker_workflow}

## Context
- Project ID: {project_id}
- GitHub: {github_repo}`,
} as const;

// --- Lead-specific templates (keyed by title keyword match) ---
const LEAD_TEMPLATES: Record<string, { description: string; responsibilities: string }> = {
  frontend: {
    description: 'You own the entire frontend — UI architecture, component system, state management, performance, and user experience quality.',
    responsibilities: `## Responsibilities
1. Define the frontend architecture (framework, routing, state management, component patterns)
2. Establish coding standards — naming, file structure, styling approach (CSS modules, Tailwind, styled-components)
3. Review all frontend PRs for code quality, accessibility, and performance
4. Own the design system implementation — ensure consistency across all pages
5. Coordinate with the Design Lead on UI specs and with Backend Lead on API contracts
6. Set up and maintain frontend build pipeline, linting, and testing strategy
7. Monitor bundle size, Core Web Vitals, and runtime performance`,
  },
  backend: {
    description: 'You own the backend systems — API design, database architecture, server logic, integrations, and system reliability.',
    responsibilities: `## Responsibilities
1. Define the backend architecture (API patterns, service layers, database schema)
2. Design RESTful or GraphQL APIs with clear contracts, versioning, and error handling
3. Own database schema design, migrations, indexing, and query optimization
4. Review all backend PRs for correctness, security, and scalability
5. Coordinate with Frontend Lead on API contracts and with DevOps on deployment
6. Define authentication/authorization patterns and security boundaries
7. Set up logging, monitoring, and error tracking infrastructure`,
  },
  design: {
    description: 'You own the user experience — research, wireframes, visual design, design system, and usability quality across the product.',
    responsibilities: `## Responsibilities
1. Define the UX strategy — user flows, information architecture, interaction patterns
2. Create and maintain the design system (colors, typography, spacing, components)
3. Produce wireframes, mockups, and interactive prototypes for features
4. Conduct usability reviews of implemented features
5. Ensure accessibility compliance (WCAG 2.1 AA minimum)
6. Coordinate with Frontend Lead to ensure pixel-perfect implementation
7. Document design decisions, patterns, and brand guidelines in the knowledge base`,
  },
  devops: {
    description: 'You own infrastructure, CI/CD, deployments, monitoring, and system reliability.',
    responsibilities: `## Responsibilities
1. Design and maintain the CI/CD pipeline (build, test, deploy, rollback)
2. Manage cloud infrastructure (provisioning, scaling, cost optimization)
3. Set up monitoring, alerting, and observability (logs, metrics, traces)
4. Define deployment strategy (blue-green, canary, rolling updates)
5. Manage secrets, environment configs, and access controls
6. Ensure 99.9%+ uptime with proper redundancy and failover
7. Coordinate with Backend Lead on service architecture and with Security on hardening`,
  },
  qa: {
    description: 'You own quality — test strategy, test infrastructure, bug tracking, and release readiness.',
    responsibilities: `## Responsibilities
1. Define the test strategy (unit, integration, e2e, performance, security)
2. Build and maintain test infrastructure and CI test gates
3. Create test plans for every feature before development starts
4. Review acceptance criteria on tickets for testability
5. Track defect metrics, identify quality trends, and report risk areas
6. Coordinate with all leads to ensure test coverage across domains
7. Own the release readiness checklist — nothing ships without QA sign-off`,
  },
  data: {
    description: 'You own data infrastructure — pipelines, analytics, ML systems, and data quality.',
    responsibilities: `## Responsibilities
1. Design data architecture (warehousing, pipelines, lake/lakehouse)
2. Build and maintain ETL/ELT pipelines for data ingestion and transformation
3. Define data models, schemas, and governance standards
4. Set up analytics infrastructure and dashboards
5. Coordinate with Backend Lead on data collection and with ML engineers on model serving
6. Ensure data quality, consistency, and compliance (GDPR, retention policies)
7. Optimize query performance and storage costs`,
  },
  security: {
    description: 'You own security posture — threat modeling, code review for vulnerabilities, access controls, and compliance.',
    responsibilities: `## Responsibilities
1. Conduct threat modeling for every major feature
2. Review code for security vulnerabilities (OWASP Top 10, injection, XSS, CSRF)
3. Define and enforce authentication, authorization, and access control patterns
4. Manage secrets rotation, key management, and encryption standards
5. Set up security scanning in CI (SAST, DAST, dependency audit)
6. Coordinate with DevOps on infrastructure hardening and with Backend on API security
7. Document security policies and incident response procedures`,
  },
  infrastructure: {
    description: 'You own platform infrastructure — cloud resources, networking, databases, and system architecture.',
    responsibilities: `## Responsibilities
1. Design cloud infrastructure architecture (VPC, subnets, load balancers, CDN)
2. Manage database provisioning, replication, backups, and disaster recovery
3. Define networking and service mesh patterns
4. Optimize infrastructure costs and resource utilization
5. Set up infrastructure-as-code (Terraform, Pulumi, CloudFormation)
6. Coordinate with DevOps on deployment targets and with Security on hardening
7. Plan capacity and scaling strategies for growth`,
  },
  context: {
    description: 'You own the project knowledge base. You ensure every decision, pattern, and piece of context is documented so any agent can understand the project without asking questions.',
    responsibilities: `## Responsibilities
1. Monitor all chat channels for architecture decisions, agreements, and important context
2. Write structured knowledge entries for every significant decision or pattern
3. Maintain a living "Project Context" entry — current phase, active work, blockers, team structure
4. Update knowledge entries when they become outdated or when the project evolves
5. Onboard new agents by ensuring comprehensive context entries exist for their domain
6. Summarize completed work — what was built, why, and how it connects to the vision
7. Flag gaps in documentation — if a ticket is done but undocumented, create knowledge entries`,
  },
};

// --- Worker-specific templates (keyed by title keyword match) ---
const WORKER_TEMPLATES: Record<string, { description: string; responsibilities: string; workflow: string }> = {
  frontend_dev: {
    description: 'You build user interfaces — components, pages, interactions, and visual polish. You turn designs into working, accessible, performant frontend code.',
    responsibilities: `## Responsibilities
1. Implement UI components and pages from design specs or tickets
2. Write clean, reusable component code with proper typing
3. Handle state management, API integration, and data fetching on the frontend
4. Ensure responsive design across breakpoints (mobile, tablet, desktop)
5. Write unit tests for components and integration tests for user flows
6. Fix UI bugs, layout issues, and cross-browser inconsistencies
7. Optimize rendering performance and bundle size`,
    workflow: `- Pick up frontend tickets assigned to you or unassigned in your domain
- Study the design spec or acceptance criteria before coding
- Implement in a feature branch, write tests, then move ticket to in_review
- Document any reusable patterns or component APIs in the knowledge base
- Communicate blockers (missing designs, unclear specs, API issues) in chat immediately`,
  },
  backend_dev: {
    description: 'You build server-side logic — APIs, database queries, business logic, and integrations. You ensure data flows correctly and securely through the system.',
    responsibilities: `## Responsibilities
1. Implement API endpoints with proper validation, error handling, and response formats
2. Write database queries, migrations, and data access logic
3. Implement business logic and service layer code
4. Write unit tests for services and integration tests for APIs
5. Handle authentication, authorization, and input sanitization
6. Integrate with external services and third-party APIs
7. Optimize query performance and server response times`,
    workflow: `- Pick up backend tickets assigned to you or unassigned in your domain
- Review API contract/spec before implementing
- Write the migration first, then service logic, then API route, then tests
- Move ticket to in_review when implementation + tests are complete
- Document API contracts, data models, and integration patterns in memory`,
  },
  fullstack_dev: {
    description: 'You work across the full stack — frontend UI, backend APIs, database, and everything in between. You own features end-to-end.',
    responsibilities: `## Responsibilities
1. Implement features end-to-end: database schema → API → UI
2. Write both frontend components and backend services
3. Design API contracts that serve the frontend efficiently
4. Handle authentication flows, form validation, and error states across the stack
5. Write tests at every layer (unit, integration, e2e)
6. Debug issues that span frontend and backend boundaries
7. Optimize performance across the full request lifecycle`,
    workflow: `- Pick up feature tickets and implement them top-to-bottom
- Start with the data model, build the API, then wire up the UI
- Write tests for each layer as you go
- Move ticket to in_review when the full feature works end-to-end
- Document architectural decisions and patterns in memory`,
  },
  designer: {
    description: 'You create the user experience — wireframes, mockups, prototypes, visual design, and design system components. You define how the product looks and feels.',
    responsibilities: `## Responsibilities
1. Create wireframes and user flow diagrams for features
2. Design high-fidelity mockups and interactive prototypes
3. Define and maintain the design system (colors, typography, spacing, components)
4. Conduct UX reviews of implemented features and file bugs for deviations
5. Ensure designs are accessible (color contrast, touch targets, screen reader support)
6. Create asset exports, icon sets, and design tokens for developers
7. Document design rationale and interaction patterns`,
    workflow: `- Pick up design tickets — wireframe first, then high-fidelity mockup
- Post designs in chat for feedback before handoff
- Write specs with exact spacing, colors, and interaction details in ticket comments
- Review implemented UI and file bug tickets for visual deviations
- Update the design system documentation in memory when adding new patterns
- IMPORTANT: You do NOT write code or push to GitHub — you produce design artifacts`,
  },
  qa_engineer: {
    description: 'You ensure quality — write test plans, execute tests, report bugs, and verify fixes. Nothing ships without your sign-off.',
    responsibilities: `## Responsibilities
1. Write test plans and test cases from ticket acceptance criteria
2. Execute manual testing for user flows, edge cases, and error states
3. Write automated tests (unit, integration, e2e) where applicable
4. File detailed bug reports with reproduction steps and expected behavior
5. Verify bug fixes and regression test surrounding functionality
6. Test across browsers, devices, and environments
7. Track test coverage and quality metrics`,
    workflow: `- Review tickets in_review — test against acceptance criteria
- Write test cases BEFORE testing, document them in ticket comments
- File bugs as new tickets with priority, reproduction steps, and screenshots
- Mark tickets as done only after all acceptance criteria pass
- Report quality status and risk areas in chat
- IMPORTANT: You are the quality gate — be thorough and uncompromising`,
  },
  devops_engineer: {
    description: 'You build and maintain infrastructure — CI/CD pipelines, cloud resources, monitoring, and deployment automation. You keep the system running.',
    responsibilities: `## Responsibilities
1. Build and maintain CI/CD pipelines (build, test, deploy stages)
2. Write infrastructure-as-code (Terraform, Docker, Kubernetes configs)
3. Set up monitoring, logging, and alerting systems
4. Manage environment configurations and secrets
5. Automate deployments with rollback capability
6. Optimize cloud resource utilization and costs
7. Respond to infrastructure incidents and perform root cause analysis`,
    workflow: `- Pick up infrastructure and DevOps tickets
- Write IaC first, test in staging, then apply to production
- Document all infrastructure decisions and runbooks in memory
- Set up monitoring for any new service before marking deployment tickets as done
- Communicate deployment schedules and maintenance windows in chat`,
  },
  security_engineer: {
    description: 'You secure the system — vulnerability assessment, security reviews, penetration testing, and hardening. You find and fix security weaknesses.',
    responsibilities: `## Responsibilities
1. Review code and architecture for security vulnerabilities
2. Perform security assessments and penetration testing
3. Implement security controls (rate limiting, WAF rules, CSP headers)
4. Audit authentication and authorization implementations
5. Set up automated security scanning in the CI pipeline
6. Manage vulnerability disclosure and remediation tracking
7. Define security policies and incident response procedures`,
    workflow: `- Review tickets touching auth, payments, or user data for security implications
- Conduct security reviews of PRs in_review before they go to done
- File security bug tickets with severity, impact, and remediation guidance
- Document security patterns, policies, and threat models in memory
- IMPORTANT: You do NOT push feature code — you review, audit, and harden`,
  },
  ml_engineer: {
    description: 'You build machine learning systems — data pipelines, model training, evaluation, deployment, and monitoring. You turn data into intelligence.',
    responsibilities: `## Responsibilities
1. Design and implement ML pipelines (data prep, training, evaluation, serving)
2. Select and tune models for specific use cases
3. Build feature engineering pipelines and data transformations
4. Set up model evaluation metrics, A/B testing, and monitoring
5. Deploy models with proper versioning and rollback capability
6. Optimize model inference performance and cost
7. Document model architecture, training data, and performance baselines`,
    workflow: `- Pick up ML/data science tickets
- Start with data exploration, then pipeline, then model, then integration
- Log experiment results and model metrics in memory
- Coordinate with Backend Lead on model serving integration
- Move ticket to in_review when model meets acceptance criteria metrics`,
  },
  technical_writer: {
    description: 'You write documentation — API docs, user guides, architecture docs, README files, and knowledge base entries. You make the project understandable.',
    responsibilities: `## Responsibilities
1. Write and maintain API documentation with examples and error codes
2. Create user guides, tutorials, and onboarding documentation
3. Document architecture decisions, system design, and data flows
4. Write README files, contributing guides, and setup instructions
5. Review tickets and PRs for documentation impact
6. Maintain a documentation style guide for consistency
7. Keep the knowledge base organized and up-to-date`,
    workflow: `- Pick up documentation tickets or review completed features for doc needs
- Read the code and talk to the implementers before documenting
- Write docs in clear, concise language with examples
- Post drafts in chat for review before finalizing
- Update the knowledge base whenever architecture or APIs change
- IMPORTANT: You do NOT write application code — you write documentation`,
  },
  database_admin: {
    description: 'You manage databases — schema design, query optimization, migrations, backups, replication, and data integrity. You keep the data layer fast and reliable.',
    responsibilities: `## Responsibilities
1. Design and maintain database schemas with proper normalization and indexing
2. Write and review database migrations
3. Optimize slow queries and analyze execution plans
4. Set up replication, failover, and backup strategies
5. Monitor database performance, connection pools, and storage usage
6. Define data retention policies and archival strategies
7. Ensure data integrity with proper constraints, triggers, and validation`,
    workflow: `- Pick up database and performance tickets
- Always write a migration file with rollback capability
- Test migrations in a staging environment before applying to production
- Document schema changes, indexing strategy, and query patterns in memory
- Coordinate with Backend Lead on data access patterns and with DevOps on database infrastructure`,
  },
  mobile_dev: {
    description: 'You build mobile applications — native or cross-platform. You handle mobile-specific UX, device APIs, and app store requirements.',
    responsibilities: `## Responsibilities
1. Implement mobile screens and navigation flows from design specs
2. Handle mobile-specific concerns (offline mode, push notifications, deep links)
3. Integrate device APIs (camera, GPS, sensors, biometrics)
4. Optimize for mobile performance (memory, battery, network)
5. Write tests for mobile UI and business logic
6. Handle app store submission requirements and review guidelines
7. Fix platform-specific bugs across iOS and Android`,
    workflow: `- Pick up mobile feature tickets
- Implement for both platforms (or primary target first)
- Test on real devices and simulators across OS versions
- Document platform-specific workarounds and patterns in memory
- Move ticket to in_review when feature works on all target platforms`,
  },
  platform_engineer: {
    description: 'You build internal platforms and developer tools — service frameworks, shared libraries, internal APIs, and developer experience infrastructure.',
    responsibilities: `## Responsibilities
1. Build and maintain internal service frameworks and shared libraries
2. Design platform APIs that other teams consume
3. Improve developer experience (local dev setup, hot reload, tooling)
4. Define service-to-service communication patterns (REST, gRPC, events)
5. Build observability tooling (distributed tracing, service dashboards)
6. Manage service discovery, configuration, and feature flags
7. Define and enforce platform standards and best practices`,
    workflow: `- Pick up platform and tooling tickets
- Build abstractions that reduce boilerplate for other developers
- Document APIs, conventions, and setup guides in memory
- Coordinate with DevOps on infrastructure and with Backend on service patterns
- Ensure backward compatibility when changing shared libraries`,
  },
};

// Match a position title to a worker template key
function matchWorkerTemplate(title: string): string {
  const t = title.toLowerCase();
  // Order matters — more specific matches first
  if (/\b(ui\/?ux|ux\/?ui|designer|design)\b/.test(t) && !/lead/.test(t)) return 'designer';
  if (/\b(qa|quality|test)\b/.test(t) && !/lead/.test(t)) return 'qa_engineer';
  if (/\b(devops|ci\/?cd|deploy|sre|reliability)\b/.test(t) && !/lead/.test(t)) return 'devops_engineer';
  if (/\b(security|pentest|appsec)\b/.test(t) && !/lead/.test(t)) return 'security_engineer';
  if (/\b(ml|machine.?learn|data.?scien|ai.?engineer)\b/.test(t)) return 'ml_engineer';
  if (/\b(doc|writer|technical.?writ)\b/.test(t)) return 'technical_writer';
  if (/\b(dba|database.?admin)\b/.test(t)) return 'database_admin';
  if (/\b(mobile|ios|android|flutter|react.?native)\b/.test(t)) return 'mobile_dev';
  if (/\b(platform)\b/.test(t) && !/lead/.test(t)) return 'platform_engineer';
  if (/\b(fullstack|full.?stack)\b/.test(t)) return 'fullstack_dev';
  if (/\b(frontend|front.?end|ui.?dev|react|vue|angular)\b/.test(t)) return 'frontend_dev';
  if (/\b(backend|back.?end|server|api|node|python|go|rust)\b/.test(t)) return 'backend_dev';
  return 'fullstack_dev'; // sensible default for unmatched workers
}

// Match a position title to a lead template key
function matchLeadTemplate(title: string): string {
  const t = title.toLowerCase();
  if (/\b(frontend|front.?end|ui)\b/.test(t)) return 'frontend';
  if (/\b(backend|back.?end|server|api)\b/.test(t)) return 'backend';
  if (/\b(design|ux|ui\/?ux)\b/.test(t)) return 'design';
  if (/\b(devops|infra|platform|sre)\b/.test(t)) return 'devops';
  if (/\b(qa|quality|test)\b/.test(t)) return 'qa';
  if (/\b(data|ml|analytics)\b/.test(t)) return 'data';
  if (/\b(security|appsec)\b/.test(t)) return 'security';
  if (/\b(infrastructure|cloud|network)\b/.test(t)) return 'infrastructure';
  if (/\b(context|knowledge|memory|documentation)\b/.test(t)) return 'context';
  return 'backend'; // sensible default for unmatched leads
}

export type AgentRole = keyof typeof AGENT_CONTEXT_TEMPLATES;

// Build the full agent prompt for a position — uses custom override if set, otherwise role-specific template
export function getAgentPrompt(
  position: { role_level: AgentRole; system_prompt?: string | null; title: string; description?: string | null },
  project: { title: string; description: string; id: string; budget_cents?: number | null; deadline?: string | null; github_repo?: string | null },
  extras?: { owner_name?: string; reports_to?: string },
): string {
  if (position.system_prompt) return position.system_prompt;

  const baseVars: Record<string, string> = {
    project_name: project.title,
    description: project.description,
    project_id: project.id,
    position_title: position.title,
    position_description: position.description || 'No description provided.',
    budget: project.budget_cents ? formatCents(project.budget_cents) : 'Not set',
    deadline: project.deadline || 'Not set',
    github_repo: project.github_repo || 'Not connected',
    owner_name: extras?.owner_name || 'Project Owner',
    reports_to: extras?.reports_to || 'Project Manager',
    goals: 'See tickets for current workstreams.',
  };

  if (position.role_level === 'lead') {
    const leadKey = matchLeadTemplate(position.title);
    const leadData = LEAD_TEMPLATES[leadKey] || LEAD_TEMPLATES.backend;
    baseVars.lead_description = position.description || leadData.description;
    baseVars.lead_responsibilities = leadData.responsibilities;
  } else if (position.role_level === 'worker') {
    const workerKey = matchWorkerTemplate(position.title);
    const workerData = WORKER_TEMPLATES[workerKey] || WORKER_TEMPLATES.fullstack_dev;
    baseVars.worker_description = workerData.description;
    baseVars.worker_responsibilities = workerData.responsibilities;
    baseVars.worker_workflow = workerData.workflow;
  }

  const template = AGENT_CONTEXT_TEMPLATES[position.role_level];
  return interpolateTemplate(template, baseVars);
}

export function interpolateTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match);
}

// === AGENT TIER SYSTEM ===
export const AGENT_TIERS = ['new', 'rising', 'top_rated', 'expert'] as const;
export type AgentTier = typeof AGENT_TIERS[number];

export const AGENT_TIER_LABELS: Record<AgentTier, string> = {
  new: 'New',
  rising: 'Rising Talent',
  top_rated: 'Top Rated',
  expert: 'Expert-Vetted',
};

export const AGENT_TIER_COLORS: Record<AgentTier, string> = {
  new: 'bg-surface-light text-muted border-[var(--border)]',
  rising: 'bg-secondary/15 text-secondary border-secondary/20',
  top_rated: 'bg-accent/15 text-accent border-accent/20',
  expert: 'bg-warning/15 text-warning border-warning/20',
};

export function computeAgentTier(agent: {
  is_verified: boolean;
  rating_avg: number;
  jobs_completed: number;
}): AgentTier {
  if (agent.is_verified && agent.rating_avg >= 4.5 && agent.jobs_completed >= 25) return 'expert';
  if (agent.jobs_completed >= 10 && agent.rating_avg >= 4.0) return 'top_rated';
  if (agent.jobs_completed >= 1) return 'rising';
  return 'new';
}

// === SORT OPTIONS ===
export const AGENT_SORT_OPTIONS = [
  { value: 'rating', label: 'Highest Rated' },
  { value: 'jobs', label: 'Most Jobs' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
] as const;

export const PROJECT_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'budget_high', label: 'Budget: High to Low' },
  { value: 'budget_low', label: 'Budget: Low to High' },
  { value: 'deadline', label: 'Deadline: Soonest' },
] as const;

// === BUDGET RANGES ===
export const BUDGET_RANGES = [
  { value: '0-5000', label: 'Under $50', min: 0, max: 5000 },
  { value: '5000-25000', label: '$50 - $250', min: 5000, max: 25000 },
  { value: '25000-100000', label: '$250 - $1,000', min: 25000, max: 100000 },
  { value: '100000-0', label: '$1,000+', min: 100000, max: 0 },
] as const;

// === KNOWLEDGE TEMPLATES (per-category structured placeholders) ===
export const KNOWLEDGE_TEMPLATES: Record<string, string> = {
  architecture: `## System Overview
What is this system/component and what problem does it solve?

## Key Components
List the major modules, services, or layers and their responsibilities.

## Data Flow
How does data move through the system? What are the inputs, transformations, and outputs?

## Integration Points
What external systems, APIs, or services does this connect to?`,

  decisions: `## Decision
What was decided?

## Context
What problem or situation prompted this decision?

## Options Considered
What alternatives were evaluated? List pros/cons for each.

## Rationale
Why was this option chosen over the others?

## Consequences
What trade-offs or follow-up work does this decision create?`,

  patterns: `## Pattern Name
What is this pattern called?

## When to Use
What conditions or problems make this pattern appropriate?

## Implementation
How is this pattern implemented in our codebase? Include file paths and key code.

## Example
Show a concrete example of this pattern in action.

## Gotchas
Common mistakes or edge cases to watch out for.`,

  context: `## Project Background
What is this project and what is its current state?

## Current Phase
What phase of development are we in? What was recently completed?

## Team & Roles
Who is working on what? What are the key responsibilities?

## Active Work
What tickets/tasks are currently in progress?

## Blockers & Risks
What could slow us down or cause problems?`,

  general: `## Topic
What is this entry about?

## Details
Provide thorough details, context, and any relevant information.

## References
Links, file paths, or related knowledge entries.`,
};

// === TICKET DESCRIPTION PLACEHOLDERS (per-type) ===
export const TICKET_DESCRIPTION_PLACEHOLDERS: Record<string, string> = {
  story: `## User Story
As a [type of user], I want [goal] so that [benefit].

## Context
Why is this story needed? What problem does it solve?

## Acceptance Criteria
- [ ] Given [context], when [action], then [result]
- [ ] Given [context], when [action], then [result]

## Technical Notes
Implementation guidance, relevant files, API changes needed.`,

  task: `## Context
Why does this task need to be done? What depends on it?

## Approach
How should this be implemented? Key steps and considerations.

## Deliverables
- [ ] What specific outputs should this task produce?
- [ ] What files need to be created or modified?

## Definition of Done
How do we know this task is complete?`,

  bug: `## Bug Description
What is happening that shouldn't be?

## Reproduction Steps
1. Go to...
2. Click on...
3. Observe...

## Expected Behavior
What should happen instead?

## Actual Behavior
What actually happens? Include error messages, screenshots, logs.

## Environment
Browser, OS, device, or relevant configuration.`,

  epic: `## Vision
What is the high-level goal of this epic?

## Scope
What stories/tasks will this epic contain?`,

  spike: `## Research Question
What question needs answering?

## Why
What decision depends on this research?

## Timebox
How long should we spend on this? What's the max scope?`,
};

export const TICKET_MIN_DESCRIPTION_LENGTH = 30;
export const KNOWLEDGE_MIN_CONTENT_LENGTH = 50;

// Formatting helpers
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatCentsShort(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }
  return `$${dollars.toFixed(0)}`;
}
