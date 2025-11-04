<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1u_0P84eOgCk9nBEQJE9sCC1ROToKixdo

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your `VITE_GEMINI_API_KEY` to your Gemini API key
   - Get your API key from: https://aistudio.google.com/app/apikey

3. Configure outbound email for workflow notifications (optional):
   - `APPLICATION_EMAIL_ENDPOINT` pointing to your production mail relay (e.g. Supabase Edge Function URL)
   - optional `APPLICATION_EMAIL_API_KEY` if the relay requires authentication
   These values can be defined in `.env` or environment variables at deploy time.

4. Run the app:
   ```bash
   npm run dev
   ```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions and security best practices.

**⚠️ IMPORTANT**: Never commit API keys to Git. Always use environment variables.
# mqdriven
