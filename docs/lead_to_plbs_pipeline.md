# Lead → PL/BS Pipeline (v2)

Fresh, typed entities for forward-only data. Use these names in future API bindings and Supabase RPCs.

## Core tables
- `public.leads_v2`: lead intake with `lead_code`, `status`, `expected_close_date`, `expected_amount`, `customer_id`, `owner_id`.
- `public.projects_v2`: hub; always link to `customer_id`, optionally `lead_id`; holds `project_code`, budgets, delivery/due dates, status fields.
- `public.project_budgets_v2`: per-period budget rows (`period_start`/`period_end`, `budget_sales`, `budget_cost`).
- `public.estimates_v2` + `public.estimate_items_v2`: normalized estimate header/lines; totals are generated; `is_primary_for_project` in the view selects the accepted/latest.
- `public.orders_v2`: typed orders (`order_type` = sales/purchase/subcontract/internal) with generated `amount`, explicit `variable_cost`, cost confirmation flags.
- `public.project_expenses_v2`: direct project costs that bypass purchasing.
- `public.invoices_v2`: revenue recognition; totals generated from subtotal + tax.
- Code helpers / RPCs: `generate_lead_code`, `generate_project_code`, `generate_order_code`, `generate_invoice_code`, `create_project_v2`, `upsert_project_budget_v2`, `accept_estimate_v2`.
- Creation helpers: `create_lead_v2`, `create_estimate_with_items_v2` (header + line JSON), `create_order_v2`, `confirm_order_cost_v2`, `create_invoice_v2`.
- Direct inserts: `lead_code`, `project_code`, `estimate_number`, `order_code`, `invoice_code` all auto-generate by default—clients may omit them.
- Billing & payments: `receivables_v2`/`receipts_v2` for AR; `payables_v2`/`disbursements_v2` for AP; helpers `create_receivable_from_invoice_v2`, `record_receipt_v2`, `create_payable_v2`, `record_disbursement_v2`.

## Views (bind UI/API here)
- `public.estimate_details_list_view`: clean line items with MQ metrics.
- `public.estimates_list_view`: header rollup with subtotal/total, variable cost, MQ, customer/project/lead context, and `is_primary_for_project`.
- `public.orders_list_view`: revenue vs cost orders with MQ; non-sales orders are treated as cost-only.
- `public.invoices_list_view`: invoice headers with revenue totals.
- `public.project_financials_view`: budgets vs actuals (orders + expenses, invoices override sales), forecast from primary estimate, MQ and variance.
- `public.lead_to_cash_view`: lead → project → estimate → first/last order/invoice dates plus financials.
- `public.mq_project_monthly_view`, `public.mq_customer_monthly_view`, `public.mq_customer_ltv_view`: monthly/ltv MQ using precedence invoice > order > estimate.
- `public.customer_revenue_analytics_view`: customer-level lifetime sales/variable cost/MQ with first/last transaction dates.
- `public.customer_estimate_analysis_view`: estimate volume/value and hit-rate per customer.
- `public.customer_ar_status_view`: AR outstanding/overdue by customer.
- `public.project_cash_status_view`: per-project AR/AP balances and next due dates.
- `public.pl_monthly_view`, `public.bs_monthly_view`, `public.project_accounting_view`: month-level P/L, B/S, and per-project accounting using `accounting.*` tables.
- `public.mq_anomalies_view`: highlights missing cost/sales or extreme MQ.

## Usage notes
- Always create a project before orders/invoices; `order_type='sales'` records revenue, other types record cost. Add direct costs via `project_expenses_v2`.
- Forecasts come from the primary estimate (accepted > sent > latest). Budgets remain explicit in `projects_v2`/`project_budgets_v2`.
- For accounting, tag `accounting.journal_lines.project_id` to flow into `project_accounting_view`; category codes drive PL/BS rollups.
- Use `accept_estimate_v2` to lock an estimate as primary and push MQ baseline to the project; use `upsert_project_budget_v2` to maintain per-period budgets.
- Use `create_estimate_with_items_v2` to capture header + items in one RPC (items array with `item_name`, `category`, `quantity`, `unit_price`, `variable_cost`, optional `tax_rate`, `line_no`).
- Use `create_order_v2` for revenue/cost orders (auto code); use `create_invoice_v2` for revenue documents (auto code).
- Use `create_receivable_from_invoice_v2` right after invoicing to track AR, then `record_receipt_v2` as payments arrive; `customer_ar_status_view` surfaces outstanding/overdue per customer.
- For AP, create a payable (`create_payable_v2`, optionally from a non-sales order) and record payments via `record_disbursement_v2`; `project_cash_status_view` shows AR/AP per project.

### Quick input example (PostgREST)
- `POST /rpc/create_lead_v2` body: `{"p_customer_id": "<customer uuid>", "p_title": "新規案件A", "p_status": "new"}`
- `POST /rpc/create_project_v2` body: `{"p_customer_id": "<customer uuid>", "p_project_name": "プロジェクトA", "p_budget_sales": 5000000, "p_budget_cost": 3000000}`
- `POST /rpc/create_estimate_with_items_v2` body: `{"p_project_id": "<project uuid>", "p_items": [{"item_name":"デザイン","category":"other","quantity":1,"unit_price":200000,"variable_cost":80000}]}` then `POST /rpc/accept_estimate_v2` with `{"p_estimate_id":"<estimate uuid>"}` to lock it.
- `POST /rpc/create_order_v2` body: `{"p_project_id":"<project uuid>","p_order_type":"sales","p_quantity":1,"p_unit_price":200000,"p_variable_cost":80000}`
- `POST /rpc/create_invoice_v2` body: `{"p_project_id":"<project uuid>","p_invoice_date":"2025-01-15","p_subtotal":200000,"p_tax_amount":20000}`
- `POST /rpc/create_receivable_from_invoice_v2` body: `{"p_invoice_id":"<invoice uuid>"}` then `POST /rpc/record_receipt_v2` with `{"p_receivable_id":"<receivable uuid>","p_amount":100000,"p_payment_date":"2025-01-25"}`
- `POST /rpc/create_payable_v2` body: `{"p_project_id":"<project uuid>","p_due_date":"2025-02-15","p_amount":120000,"p_description":"外注費"}` then `POST /rpc/record_disbursement_v2` with `{"p_payable_id":"<payable uuid>","p_amount":60000,"p_payment_date":"2025-02-10"}`
