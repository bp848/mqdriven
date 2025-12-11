/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const https = require('https');
const path = require('path');
const WebSocket = require('ws');
const { URLSearchParams, URL } = require('url');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// --- Gemini Proxy Configuration ---
const externalApiBaseUrl = 'https://generativelanguage.googleapis.com';
const externalWsBaseUrl = 'wss://generativelanguage.googleapis.com';
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

// --- Supabase Client Initialization ---
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Warning: Supabase environment variables are not fully configured (need URL + key). Application API functionality will be disabled.");
}
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const BOARD_VISIBILITY_VALUES = new Set(['all', 'public', 'private', 'assigned']);
const createRequestId = () => Math.random().toString(36).slice(2, 10);
const isUuid = value => typeof value === 'string' && UUID_REGEX.test(value);
const normalizeUuidArray = values => {
    if (!Array.isArray(values)) return [];
    return values.filter(isUuid);
};
const validateBoardPostPayload = (body = {}) => {
    const errors = [];
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const visibility = typeof body.visibility === 'string' ? body.visibility : 'all';
    const isTask = typeof body.is_task === 'boolean' ? body.is_task : false;
    const dueDate = body?.due_date ?? null;
    const assignees = body?.assignees;
    const createdBy = typeof body?.created_by === 'string' ? body.created_by : null;

    if (!title) errors.push('title is required');
    if (!content) errors.push('content is required');
    if (!BOARD_VISIBILITY_VALUES.has(visibility)) {
        errors.push(`visibility must be one of: ${Array.from(BOARD_VISIBILITY_VALUES).join(', ')}`);
    }
    if (assignees !== undefined && !Array.isArray(assignees)) {
        errors.push('assignees must be an array of UUID strings');
    }
    if (dueDate !== null && dueDate !== undefined) {
        const date = new Date(dueDate);
        if (Number.isNaN(date.getTime())) {
            errors.push('due_date must be a valid date string or null');
        }
    }
    if (createdBy && !isUuid(createdBy)) {
        errors.push('created_by must be a valid UUID');
    }

    return {
        errors,
        payload: {
            title,
            content,
            visibility,
            is_task: isTask,
            due_date: dueDate ?? null,
            assignees: normalizeUuidArray(assignees),
            created_by: createdBy && isUuid(createdBy) ? createdBy : null,
        },
    };
};
const getSupabaseStatus = error => {
    if (!error?.code) return 400;
    if (error.code === '23505') return 409;
    if (error.code === '23503') return 400;
    return 400;
};


const staticPath = path.join(__dirname,'dist');
const publicPath = path.join(__dirname,'public');


if (!apiKey) {
    // Only log an error, don't exit. The server will serve apps without proxy functionality
    console.error("Warning: GEMINI_API_KEY or API_KEY environment variable is not set! Proxy functionality will be disabled.");
}
else {
  console.log("API KEY FOUND (proxy will use this)")
}

// Limit body size to 50mb
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({extended: true, limit: '50mb'}));
app.set('trust proxy', 1 /* number of proxies between user and server */)


// --- Application API Routes for Accounting ---

// GET /api/accounting/journal-drafts - Fetches all journal drafts
app.get('/api/accounting/journal-drafts', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized. Check server configuration.' });
    }
    try {
        const { data, error } = await supabase.rpc('get_journal_drafts');

        if (error) {
            console.error('Error from get_journal_drafts RPC:', error);
            // Pass along Supabase's error details if available
            return res.status(500).json({ error: 'Database RPC error', details: error.message });
        }

        res.status(200).json(data);
    } catch (err) {
        console.error('Unexpected error in /api/accounting/journal-drafts:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/accounting/applications/:id/create-journal - Creates a journal draft from an application
app.post('/api/accounting/applications/:id/create-journal', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized. Check server configuration.' });
    }
    try {
        const applicationId = req.params.id;
        // TODO: Implement proper user authentication and pass the actual user ID.
        // For now, p_user_id is passed as null.
        const { data: batchId, error } = await supabase.rpc('create_journal_from_application', {
            p_application_id: applicationId,
            p_user_id: null 
        });

        if (error) {
            console.error('Error from create_journal_from_application RPC:', error);
             // Check for specific, user-facing errors from the RPC
            if (error.message.includes('Journal has already been created')) {
                return res.status(409).json({ error: 'Conflict', details: error.message });
            }
            if (error.message.includes('not found')) {
                return res.status(404).json({ error: 'Not Found', details: error.message });
            }
            return res.status(500).json({ error: 'Database RPC error', details: error.message });
        }

        res.status(201).json({ message: 'Journal draft created successfully', batchId });
    } catch (err) {
        console.error('Unexpected error in /api/accounting/applications/:id/create-journal:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/accounting/journal-batches/:id/approve - Approves (posts) a journal draft batch
app.post('/api/accounting/journal-batches/:id/approve', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized. Check server configuration.' });
    }
    try {
        const batchId = req.params.id;
        const { error } = await supabase.rpc('approve_journal_batch', {
            p_batch_id: batchId
        });

        if (error) {
            console.error('Error from approve_journal_batch RPC:', error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ error: 'Not Found', details: error.message });
            }
            return res.status(500).json({ error: 'Database RPC error', details: error.message });
        }

        res.status(200).json({ message: 'Journal batch approved successfully' });
    } catch (err) {
        console.error('Unexpected error in /api/accounting/journal-batches/:id/approve:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Integrated Board API Routes ---

// GET /api/board/posts - Fetch posts for the current user
app.get('/api/board/posts', async (req, res) => {
    const requestId = createRequestId();
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized.', requestId });
    }
    try {
        const { data, error } = await supabase.rpc('get_user_posts', {
            p_user_id: req.query.user_id || null
        });

        if (error) {
            console.error('Error from get_user_posts RPC:', { requestId, error });
            const status = getSupabaseStatus(error);
            return res.status(status).json({ error: error.message, requestId });
        }

        res.status(200).json(data);
    } catch (err) {
        console.error('Error in /api/board/posts GET:', { requestId, err });
        res.status(500).json({ error: 'Internal server error', requestId });
    }
});

// POST /api/board/posts - Create a new post
app.post('/api/board/posts', async (req, res) => {
    const requestId = createRequestId();
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized.', requestId });
    }
    try {
        const { errors, payload } = validateBoardPostPayload(req.body || {});
        if (errors.length) {
            return res.status(400).json({ error: 'Invalid request body', details: errors, requestId });
        }

        const { data, error } = await supabase.rpc('create_post', {
            p_title: payload.title,
            p_content: payload.content,
            p_visibility: payload.visibility,
            p_is_task: payload.is_task,
            p_due_date: payload.due_date,
            p_assignees: payload.assignees,
            p_created_by: payload.created_by
        });

        if (error) {
            const status = getSupabaseStatus(error);
            console.error('Error from create_post RPC:', { requestId, code: error.code, message: error.message, details: error.details });
            return res.status(status).json({ error: error.message, code: error.code, requestId });
        }

        if (!data) {
            console.error('create_post RPC returned no data', { requestId });
            return res.status(500).json({ error: 'Post creation failed', requestId });
        }

        res.status(201).json({ message: 'Post created successfully', post_id: data, requestId });
    } catch (err) {
        console.error('Error in /api/board/posts POST:', { requestId, err });
        res.status(500).json({ error: 'Internal server error', requestId });
    }
});

// POST /api/board/posts/:id/comments - Add comment to post
app.post('/api/board/posts/:id/comments', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized.' });
    }
    try {
        const postId = req.params.id;
        const { content, user_id } = req.body;
        
        const { data, error } = await supabase.rpc('add_comment', {
            p_post_id: postId,
            p_content: content,
            p_user_id: user_id || null
        });

        if (error) {
            console.error('Error from add_comment RPC:', error);
            return res.status(500).json({ error: 'Database error', details: error.message });
        }

        res.status(201).json({ message: 'Comment added successfully', comment_id: data });
    } catch (err) {
        console.error('Error in /api/board/posts/:id/comments:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/board/posts/:id/complete - Mark task as completed
app.put('/api/board/posts/:id/complete', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized.' });
    }
    try {
        const postId = req.params.id;
        const { user_id } = req.body;
        
        const { error } = await supabase.rpc('complete_task', {
            p_post_id: postId,
            p_user_id: user_id || null
        });

        if (error) {
            console.error('Error from complete_task RPC:', error);
            return res.status(500).json({ error: 'Database error', details: error.message });
        }

        res.status(200).json({ message: 'Task completed successfully' });
    } catch (err) {
        console.error('Error in /api/board/posts/:id/complete:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/users - Fetch employee directory with department/title info
app.get('/api/users', async (_req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Database client not initialized.' });
    }
    try {
        const [
            { data: userRows, error: userError },
            { data: departmentRows, error: departmentError },
            { data: titleRows, error: titleError },
        ] = await Promise.all([
            supabase
                .from('users')
                .select('id, name, email, role, created_at, department_id, position_id, is_active')
                .order('name', { ascending: true }),
            supabase.from('departments').select('id, name'),
            supabase.from('employee_titles').select('id, name'),
        ]);

        if (userError) {
            console.error('Error from users table query:', userError);
            return res.status(500).json({ error: 'Database error', details: userError.message });
        }
        if (departmentError) {
            console.warn('Failed to fetch departments for user mapping:', departmentError.message);
        }
        if (titleError) {
            console.warn('Failed to fetch titles for user mapping:', titleError.message);
        }

        const departmentMap = new Map();
        (departmentRows || []).forEach(row => {
            if (row?.id) {
                departmentMap.set(row.id, row?.name ?? '');
            }
        });
        const titleMap = new Map();
        (titleRows || []).forEach(row => {
            if (row?.id) {
                titleMap.set(row.id, row?.name ?? '');
            }
        });

        const payload = (userRows || []).map(row => {
            const role = row.role === 'admin' ? 'admin' : 'user';
            const departmentName = row.department_id ? departmentMap.get(row.department_id) || null : null;
            const titleName = row.position_id ? titleMap.get(row.position_id) || null : null;
            return {
                id: row.id,
                name: row.name ?? '（未設定）',
                department: departmentName,
                title: titleName,
                email: row.email ?? '',
                role,
                createdAt: row.created_at,
                isActive: row.is_active ?? null,
            };
        });

        res.status(200).json(payload);
    } catch (err) {
        console.error('Error in /api/users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Gemini Proxy Logic ---

// Rate limiter for the proxy
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Set ratelimit window at 15min (in ms)
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // no `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
        console.warn(`Rate limit exceeded for IP: ${req.ip}. Path: ${req.path}`);
        res.status(options.statusCode).send(options.message);
    }
});

// Apply the rate limiter to the /api-proxy route before the main proxy logic
app.use('/api-proxy', proxyLimiter);

// Proxy route for Gemini API calls (HTTP)
app.use('/api-proxy', async (req, res, next) => {
    console.log(req.ip);
    // If the request is an upgrade request, it's for WebSockets, so pass to next middleware/handler
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        return next(); // Pass to the WebSocket upgrade handler
    }

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust as needed for security
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Goog-Api-Key');
        res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight response for 1 day
        return res.sendStatus(200);
    }

    if (req.body) { // Only log body if it exists
        console.log("  Request Body (from frontend):", req.body);
    }
    try {
        // Construct the target URL by taking the part of the path after /api-proxy/
        const targetPath = req.url.startsWith('/') ? req.url.substring(1) : req.url;
        const apiUrl = `${externalApiBaseUrl}/${targetPath}`;
        console.log(`HTTP Proxy: Forwarding request to ${apiUrl}`);

        // Prepare headers for the outgoing request
        const outgoingHeaders = {};
        // Copy most headers from the incoming request
        for (const header in req.headers) {
            // Exclude host-specific headers and others that might cause issues upstream
            if (!['host', 'connection', 'content-length', 'transfer-encoding', 'upgrade', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions'].includes(header.toLowerCase())) {
                outgoingHeaders[header] = req.headers[header];
            }
        }

        // Set the actual API key in the appropriate header
        outgoingHeaders['X-Goog-Api-Key'] = apiKey;

        // Set Content-Type from original request if present (for relevant methods)
        if (req.headers['content-type'] && ['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
            outgoingHeaders['Content-Type'] = req.headers['content-type'];
        } else if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
            // Default Content-Type to application/json if no content type for post/put/patch
            outgoingHeaders['Content-Type'] = 'application/json';
        }

        // For GET or DELETE requests, ensure Content-Type is NOT sent,
        // even if the client erroneously included it.
        if (['GET', 'DELETE'].includes(req.method.toUpperCase())) {
            delete outgoingHeaders['Content-Type']; // Case-sensitive common practice
            delete outgoingHeaders['content-type']; // Just in case
        }

        // Ensure 'accept' is reasonable if not set
        if (!outgoingHeaders['accept']) {
            outgoingHeaders['accept'] = '*/*';
        }


        const axiosConfig = {
            method: req.method,
            url: apiUrl,
            headers: outgoingHeaders,
            responseType: 'stream',
            validateStatus: function (status) {
                return true; // Accept any status code, we'll pipe it through
            },
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
            axiosConfig.data = req.body;
        }
        // For GET, DELETE, etc., axiosConfig.data will remain undefined,
        // and axios will not send a request body.

        const apiResponse = await axios(axiosConfig);

        // Pass through response headers from Gemini API to the client
        for (const header in apiResponse.headers) {
            res.setHeader(header, apiResponse.headers[header]);
        }
        res.status(apiResponse.status);


        apiResponse.data.on('data', (chunk) => {
            res.write(chunk);
        });

        apiResponse.data.on('end', () => {
            res.end();
        });

        apiResponse.data.on('error', (err) => {
            console.error('Error during streaming data from target API:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Proxy error during streaming from target' });
            } else {
                // If headers already sent, we can't send a JSON error, just end the response.
                res.end();
            }
        });

    } catch (error) {
        console.error('Proxy error before request to target API:', error);
        if (!res.headersSent) {
            if (error.response) {
                const errorData = {
                    status: error.response.status,
                    message: error.response.data?.error?.message || 'Proxy error from upstream API',
                    details: error.response.data?.error?.details || null
                };
                res.status(error.response.status).json(errorData);
            } else {
                res.status(500).json({ error: 'Proxy setup error', message: error.message });
            }
        }
    }
});

const webSocketInterceptorScriptTag = `<script src="/public/websocket-interceptor.js" defer></script>`;

// Prepare service worker registration script content
const serviceWorkerRegistrationScript = `
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load' , () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
} else {
  console.log('Service workers are not supported in this browser.');
}
</script>
`;

// Serve index.html or placeholder based on API key and file availability
app.get('/', (req, res) => {
    const placeholderPath = path.join(publicPath, 'placeholder.html');

    // Try to serve index.html
    console.log("LOG: Route '/' accessed. Attempting to serve index.html.");
    const indexPath = path.join(staticPath, 'index.html');

    fs.readFile(indexPath, 'utf8', (err, indexHtmlData) => {
        if (err) {
            // index.html not found or unreadable, serve the original placeholder
            console.log('LOG: index.html not found or unreadable. Falling back to original placeholder.');
            return res.sendFile(placeholderPath);
        }

        // If API key is not set, serve original HTML without injection
        if (!apiKey) {
          console.log("LOG: API key not set. Serving original index.html without script injections.");
          return res.sendFile(indexPath);
        }

        // index.html found and apiKey set, inject scripts
        console.log("LOG: index.html read successfully. Injecting scripts.");
        let injectedHtml = indexHtmlData;


        if (injectedHtml.includes('<head>')) {
            // Inject WebSocket interceptor first, then service worker script
            injectedHtml = injectedHtml.replace(
                '<head>',
                `<head>${webSocketInterceptorScriptTag}${serviceWorkerRegistrationScript}`
            );
            console.log("LOG: Scripts injected into <head>.");
        } else {
            console.warn("WARNING: <head> tag not found in index.html. Prepending scripts to the beginning of the file as a fallback.");
            injectedHtml = `${webSocketInterceptorScriptTag}${serviceWorkerRegistrationScript}${indexHtmlData}`;
        }
        res.send(injectedHtml);
    });
});

app.get('/service-worker.js', (req, res) => {
   return res.sendFile(path.join(publicPath, 'service-worker.js'));
});

app.use('/public', express.static(publicPath));
app.use(express.static(staticPath));

// Start the HTTP server
const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`HTTP proxy active on /api-proxy/**`);
    console.log(`WebSocket proxy active on /api-proxy/**`);
});

// Create WebSocket server and attach it to the HTTP server
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith('/api-proxy/')) {
        if (!apiKey) {
            console.error("WebSocket proxy: API key not configured. Closing connection.");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (clientWs) => {
            console.log('Client WebSocket connected to proxy for path:', pathname);

            const targetPathSegment = pathname.substring('/api-proxy'.length);
            const clientQuery = new URLSearchParams(requestUrl.search);
            clientQuery.set('key', apiKey);
            const targetGeminiWsUrl = `${externalWsBaseUrl}${targetPathSegment}?${clientQuery.toString()}`;
            console.log(`Attempting to connect to target WebSocket: ${targetGeminiWsUrl}`);

            const geminiWs = new WebSocket(targetGeminiWsUrl, {
                protocol: request.headers['sec-websocket-protocol'],
            });

            const messageQueue = [];

            geminiWs.on('open', () => {
                console.log('Proxy connected to Gemini WebSocket');
                // Send any queued messages
                while (messageQueue.length > 0) {
                    const message = messageQueue.shift();
                    if (geminiWs.readyState === WebSocket.OPEN) {
                        // console.log('Sending queued message from client -> Gemini');
                        geminiWs.send(message);
                    } else {
                        // Should not happen if we are in 'open' event, but good for safety
                        console.warn('Gemini WebSocket not open when trying to send queued message. Re-queuing.');
                        messageQueue.unshift(message); // Add it back to the front
                        break; // Stop processing queue for now
                    }
                }
            });

            geminiWs.on('message', (message) => {
                // console.log('Message from Gemini -> client');
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(message);
                }
            });

            geminiWs.on('close', (code, reason) => {
                console.log(`Gemini WebSocket closed: ${code} ${reason.toString()}`);
                if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
                    clientWs.close(code, reason.toString());
                }
            });

            geminiWs.on('error', (error) => {
                console.error('Error on Gemini WebSocket connection:', error);
                if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
                    clientWs.close(1011, 'Upstream WebSocket error');
                }
            });

            clientWs.on('message', (message) => {
                if (geminiWs.readyState === WebSocket.OPEN) {
                    // console.log('Message from client -> Gemini');
                    geminiWs.send(message);
                } else if (geminiWs.readyState === WebSocket.CONNECTING) {
                    // console.log('Queueing message from client -> Gemini (Gemini still connecting)');
                    messageQueue.push(message);
                } else {
                    console.warn('Client sent message but Gemini WebSocket is not open or connecting. Message dropped.');
                }
            });

            clientWs.on('close', (code, reason) => {
                console.log(`Client WebSocket closed: ${code} ${reason.toString()}`);
                if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
                    geminiWs.close(code, reason.toString());
                }
            });

            clientWs.on('error', (error) => {
                console.error('Error on client WebSocket connection:', error);
                if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
                    geminiWs.close(1011, 'Client WebSocket error');
                }
            });
        });
    } else {
        console.log(`WebSocket upgrade request for non-proxy path: ${pathname}. Closing connection.`);
        socket.destroy();
    }
});
