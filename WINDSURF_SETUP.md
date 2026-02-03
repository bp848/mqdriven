# Windsurf-Supabase RAG Integration

## Overview

This system provides a complete RAG (Retrieval-Augmented Generation) solution that integrates Windsurf Marketplace with Supabase for document processing, embedding, and intelligent Q&A.

## Architecture

```
Windsurf Marketplace → Edge Functions → Supabase (Postgres + Storage + AI)
                    ↓
                Document Sync → Text Processing → Embedding → RAG Search
```

## Components

### Database Schema (app schema)

- **documents**: Stores file metadata and content references
- **doc_chunks**: Split text chunks with embeddings for RAG
- **ai_tasks**: Background job tracking and management

### Edge Functions

1. **windsurf_sync**: Synchronizes files from Windsurf API
2. **embed_rebuild**: Processes text and generates embeddings
3. **rag_search**: Performs semantic search and Q&A

## Setup Instructions

### 1. Configure Environment Variables

Set these secrets in your Supabase project:

```bash
# Windsurf API Configuration
WINDSURF_API_TOKEN=your_windsurf_api_token

# OpenAI Configuration (for embeddings and LLM)
OPENAI_API_KEY=your_openai_api_key

# Supabase Configuration (auto-set)
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Windsurf API Endpoints

The system expects these Windsurf API endpoints (update in code as needed):

- **Files List**: `GET https://api.windsurf.ai/v1/files?since={timestamp}`
- **File Content**: `GET https://api.windsurf.ai/v1/files/{file_id}/content`

### 3. Initial Setup

```sql
-- The schema is already created, but verify:
SELECT * FROM app.documents LIMIT 1;
SELECT * FROM app.doc_chunks LIMIT 1;
SELECT * FROM app.ai_tasks LIMIT 1;
```

### 4. Manual Sync Test

```bash
# Test file synchronization
curl -X POST https://your-project.supabase.co/functions/v1/windsurf_sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Test embedding generation
curl -X POST https://your-project.supabase.co/functions/v1/embed_rebuild \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Test RAG search
curl -X POST https://your-project.supabase.co/functions/v1/rag_search \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the main features of our product?"}'
```

## Usage Examples

### File Synchronization

```javascript
// Sync all files
const response = await fetch('/functions/v1/windsurf_sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});

// Sync files updated since specific time
const response = await fetch('/functions/v1/windsurf_sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ since: '2024-01-01T00:00:00Z' })
});
```

### Embedding Generation

```javascript
// Process all documents
const response = await fetch('/functions/v1/embed_rebuild', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});

// Process specific document
const response = await fetch('/functions/v1/embed_rebuild', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ document_id: 'doc-uuid' })
});
```

### RAG Search

```javascript
const response = await fetch('/functions/v1/rag_search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "How do I configure the authentication system?",
    top_k: 5,
    similarity_threshold: 0.7,
    include_sources: true
  })
});

const result = await response.json();
console.log(result.answer);
console.log(result.sources);
```

## Scheduled Automation

### Using Supabase Cron Jobs

```sql
-- Create a cron job for automatic sync every 15 minutes
SELECT cron.schedule(
  'windsurf-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/windsurf_sync',
    headers := json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := json_encode(json_build_object())
  );
  $$
);
```

### Using External Scheduler

Alternatively, use GitHub Actions, Vercel Cron, or any external scheduler:

```yaml
# GitHub Actions example
name: Windsurf Sync
on:
  schedule:
    - cron: '*/15 * * * *'
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync files
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/windsurf_sync \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

## Monitoring and Maintenance

### Check Task Status

```sql
-- View recent tasks
SELECT * FROM app.ai_tasks 
ORDER BY created_at DESC 
LIMIT 10;

-- View failed tasks
SELECT * FROM app.ai_tasks 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

### Storage Management

```sql
-- Check storage usage
SELECT * FROM storage.objects WHERE bucket_id = 'windsurf-documents';

-- Clean up old documents (optional)
DELETE FROM app.documents 
WHERE updated_at < NOW() - INTERVAL '30 days';
```

## Security Considerations

1. **API Keys**: Store all external API keys as Supabase secrets
2. **RLS Policies**: Documents are restricted to owners and shared users
3. **Service Role**: Edge Functions use service role for backend operations
4. **Storage Access**: Large files are stored in private storage bucket

## Performance Optimization

1. **Batch Processing**: Embedding function processes documents in batches
2. **Vector Index**: Uses ivfflat index for efficient similarity search
3. **Content Threshold**: Files >10KB stored in Storage, smaller files in DB
4. **Chunk Overlap**: 200-character overlap for better context preservation

## Troubleshooting

### Common Issues

1. **Windsurf API Errors**: Check token validity and API endpoint URLs
2. **Embedding Failures**: Verify OpenAI API key and quota
3. **Storage Permission**: Ensure service role has storage access
4. **Vector Search**: Check pgvector extension and embedding dimensions

### Debug Mode

Add logging to Edge Functions for debugging:

```typescript
console.log('Processing document:', documentId);
console.error('Embedding generation failed:', error);
```

## Next Steps

1. **Update Windsurf API endpoints** with actual URLs
2. **Configure authentication** for user-specific access
3. **Add webhooks** for real-time sync triggers
4. **Implement UI** for document management and search
5. **Add caching** for frequently accessed documents

## API Reference

### windsurf_sync

- **Method**: POST
- **Body**: `{ since?: string, user_id?: string }`
- **Response**: `{ success: boolean, synced_count: number, error_count: number }`

### embed_rebuild

- **Method**: POST  
- **Body**: `{ document_id?: string, since?: string, batch_size?: number }`
- **Response**: `{ success: boolean, processed_count: number, error_count: number }`

### rag_search

- **Method**: POST
- **Body**: `{ query: string, top_k?: number, similarity_threshold?: number, include_sources?: boolean }`
- **Response**: `{ answer: string, sources?: [...], query: string, model_used: string }`
