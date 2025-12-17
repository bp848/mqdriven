import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: "missing user_id" });
  }

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      access_type: "offline",
      scope: "https://www.googleapis.com/auth/calendar",
      prompt: "consent",
      state: String(user_id),
      response_type: "code",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    });

  res.status(200).json({ authUrl });
}
