-- AI Integration storage for DeepWiki, Memory, and Training corpus
create table if not exists public.ai_product_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    factory_area text,
    created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_ai_product_categories_name on public.ai_product_categories(lower(name));

create table if not exists public.ai_deep_wiki_documents (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references public.customers(id) on delete set null,
    source text not null,
    title text,
    snippet text,
    content text,
    metadata jsonb default '{}'::jsonb,
    language text default 'ja',
    embedding vector(1536),
    created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_ai_deep_wiki_customer on public.ai_deep_wiki_documents(customer_id);
create index if not exists idx_ai_deep_wiki_language on public.ai_deep_wiki_documents(language);

create table if not exists public.ai_memory_entities (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    entity_type text,
    observations text[] default array[]::text[],
    source text,
    customer_id uuid references public.customers(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists idx_ai_memory_entity_unique on public.ai_memory_entities(customer_id, lower(name), entity_type);

create table if not exists public.ai_memory_relations (
    id uuid primary key default gen_random_uuid(),
    entity_id uuid not null references public.ai_memory_entities(id) on delete cascade,
    related_entity_id uuid not null references public.ai_memory_entities(id) on delete cascade,
    relation_type text not null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_ai_memory_relations_entity on public.ai_memory_relations(entity_id);

create table if not exists public.ai_training_corpus (
    id uuid primary key default gen_random_uuid(),
    dataset_name text not null,
    entry_type text not null,
    payload jsonb not null,
    embeddings vector(1536),
    tags text[] default array[]::text[],
    provenance jsonb default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_ai_training_corpus_dataset on public.ai_training_corpus(dataset_name);

create table if not exists public.ai_training_labels (
    id uuid primary key default gen_random_uuid(),
    corpus_id uuid not null references public.ai_training_corpus(id) on delete cascade,
    label_key text not null,
    label_value text not null,
    created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_ai_training_labels_key on public.ai_training_labels(label_key);

-- Seed initial categories for integration console
insert into public.ai_product_categories (name, description, factory_area)
values
    ('商業印刷（チラシ・パンフレット・ポスター）', '商業プロモーション・広告媒体', '販促'),
    ('出版印刷（書籍・会報・年史）', '書籍・会報・年史などの出版物', '出版'),
    ('事務用印刷（名刺・封筒・各種伝票）', '名刺や伝票などの事務用途印刷物', '事務'),
    ('パッケージ・包装資材（化粧箱・ラベル）', '製品パッケージやラベル印刷', '包装'),
    ('販促ツール（ノベルティ・POP）', 'イベント・店頭プロモ関連資材', '販促'),
    ('大判出力・サイングラフィックス', '大型看板やディスプレイ出力', '大判'),
    ('デジタル・バリアブル印刷', '可変情報を含むデジタル印刷', 'デジタル')
on conflict (name) do nothing;
