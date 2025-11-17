# Project Management Agent Specification (ver.0)

This document translates the agent instructions into concrete technical assets: database DDL drafts, TypeScript domain types, and API/view interface proposals. The system treats `Project` as the single hub entity; every operational record (orders, expenses, deliverables) must reference a project to remain queryable per company.

## 1. Core Principles
- All operational facts (orders, expenses) require `project_id`; no orphan rows.
- `project_code` is generated server-side (sequence/RPC) and returned to the client during project creation.
- Budget vs. actual tracking happens at both project and company scopes, with deliverable status and due dates surfaced for prioritization.
- Orders capture both revenue and cost actuals; Expenses capture project-level costs that bypass purchasing.

## 2. Database DDL Draft

```sql
create table public.projects (
  project_id uuid primary key default gen_random_uuid(),
  project_code text not null unique,        -- issued by RPC/sequence
  company_id uuid not null,                 -- FK to companies/customers
  project_name text not null,
  status text not null default 'planning',  -- e.g. planning/in_progress/completed/canceled
  budget_sales numeric(14,2) not null default 0,
  budget_cost numeric(14,2) not null default 0,
  expected_revenue numeric(14,2),           -- mirrors estimate if needed
  due_date date,
  delivery_date_actual date,
  delivery_status text not null default 'not_started',
  deliverable_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_company_id_idx on public.projects (company_id);
create index projects_status_due_idx on public.projects (status, due_date);

create table public.orders (
  order_id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(project_id) on delete cascade,
  order_type text not null check (order_type in ('sales','purchase','subcontract','internal')),
  order_date date not null default current_date,
  item_description text not null,
  quantity numeric(14,4) not null default 1,
  unit_price numeric(14,2) not null default 0,
  amount numeric(14,2) not null,            -- denormalized for reporting
  status text not null default 'ordered',   -- ordered/received/invoiced/etc
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_project_id_idx on public.orders (project_id);
create index orders_type_status_idx on public.orders (order_type, status);

create table public.expenses (
  expense_id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(project_id) on delete cascade,
  expense_date date not null default current_date,
  category text not null,                   -- travel, outsourcing, misc, etc.
  description text,
  amount numeric(14,2) not null,
  status text not null default 'submitted', -- submitted/approved/paid
  created_by uuid not null,                 -- FK to users if available
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_project_id_idx on public.expenses (project_id);
create index expenses_status_idx on public.expenses (status);
```

### Aggregation View Example

```sql
create view public.project_financial_overview as
select
  p.project_id,
  p.project_code,
  p.company_id,
  p.project_name,
  p.status,
  p.due_date,
  p.delivery_status,
  p.budget_sales,
  p.budget_cost,
  coalesce(sum(case when o.order_type = 'sales' then o.amount end), 0) as sales_actual,
  coalesce(sum(case when o.order_type <> 'sales' then o.amount end), 0) +
  coalesce(sum(e.amount), 0) as cost_actual,
  p.budget_sales - coalesce(sum(case when o.order_type = 'sales' then o.amount end), 0) as sales_variance,
  p.budget_cost - (
    coalesce(sum(case when o.order_type <> 'sales' then o.amount end), 0) +
    coalesce(sum(e.amount), 0)
  ) as cost_variance
from public.projects p
left join public.orders o on o.project_id = p.project_id
left join public.expenses e on e.project_id = p.project_id
group by p.project_id;
```

The view keeps the “one project per row” display philosophy and is the preferred data source for dashboards.

## 3. TypeScript Domain Types

```ts
export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'canceled';
export type DeliveryStatus = 'not_started' | 'in_progress' | 'delivered' | 'delayed';
export type OrderType = 'sales' | 'purchase' | 'subcontract' | 'internal';
export type OrderStatus = 'ordered' | 'received' | 'invoiced' | 'closed';
export type ExpenseStatus = 'submitted' | 'approved' | 'paid';

export interface Project {
  projectId: string;
  projectCode: string;
  companyId: string;
  projectName: string;
  status: ProjectStatus;
  budgetSales: number;
  budgetCost: number;
  expectedRevenue?: number;
  dueDate?: string;               // ISO yyyy-mm-dd
  deliveryDateActual?: string;
  deliveryStatus: DeliveryStatus;
  deliverableSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  orderId: string;
  projectId: string;
  orderType: OrderType;
  orderDate: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  expenseId: string;
  projectId: string;
  expenseDate: string;
  category: string;
  description?: string;
  amount: number;
  status: ExpenseStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFinancialSnapshot {
  projectId: string;
  projectCode: string;
  companyId: string;
  projectName: string;
  status: ProjectStatus;
  dueDate?: string;
  deliveryStatus: DeliveryStatus;
  budgetSales: number;
  budgetCost: number;
  salesActual: number;
  costActual: number;
  salesVariance: number;
  costVariance: number;
}
```

## 4. API and View Interfaces

### 4.1 Project Lifecycle
- `POST /rpc/projects.generate_code` → `{ projectCode: string }`
- `POST /projects`
  - Request: `{ companyId, projectName, dueDate, budgetSales, budgetCost, expectedRevenue?, deliverableSummary?, status? }`
  - Response: `Project`
- `GET /projects?companyId=&status=` returns paginated `Project[]`.
- `GET /projects/:projectId/overview` hydrates `ProjectFinancialSnapshot` plus deliverable metadata.
- `PATCH /projects/:projectId` enforces server-side updates for status, budgets, delivery tracking.

### 4.2 Order Management
- `POST /projects/:projectId/orders`
  - Request: `Pick<Order, 'orderType'|'orderDate'|'itemDescription'|'quantity'|'unitPrice'|'amount'|'status'>`
  - Response: `Order`
- `GET /projects/:projectId/orders` lists linked orders; supports filters by `orderType` or `status`.
- `PATCH /orders/:orderId` updates fulfillment state and amount corrections.
  - API ensures `project_id` immutability to preserve hub consistency.

### 4.3 Expense Management
- `POST /projects/:projectId/expenses` requires project context in path or payload; server injects FK.
- `GET /projects/:projectId/expenses` with filter options (`status`, `category`, date range).
- `PATCH /expenses/:expenseId` controls approval workflow transitions (submitted → approved → paid).

### 4.4 Aggregated Views / Dashboards
- `GET /companies/:companyId/projects/financials`
  - Returns array of `ProjectFinancialSnapshot` sorted by `dueDate` and flagging late deliveries (`deliveryStatus === 'delayed' || dueDate < now()`).
- `GET /projects/alerts?type=budget_overrun|delivery_delay`
  - Derived from the aggregation view to highlight overruns and missed deadlines.

### 4.5 UI Binding Notes
- Sidebar/overview pages should bind to `ProjectFinancialSnapshot` to show budget vs. actual at-a-glance.
- Detail modals/forms (e.g., `ExpenseReimbursementForm`, `CreatePurchaseOrderModal`) must require the user to select or inherit `projectId` before submission.
- For new project creation flows, the client first calls the RPC to fetch `projectCode`, then submits the full payload, ensuring no client-generated codes.

## 5. Next Steps
1. Implement migrations based on the DDL draft (adjust schemas/enums to match the target DB engine).
2. Wire the new TypeScript interfaces into form components and API layers for consistent typing.
3. Expose the aggregation view via a Supabase RPC or REST endpoint for dashboards and approval workflows.

This specification should keep the agent aligned with the “Project hub” architecture while leaving room to extend categories, statuses, and derived analytics as the system matures.
