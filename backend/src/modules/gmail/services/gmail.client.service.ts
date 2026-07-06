import { google, gmail_v1 } from "googleapis";
import { PrismaClient } from "@prisma/client";
import { decryptToken } from "../../../utils/encryption";

const prisma = new PrismaClient();

export class GmailClientService {
  async getAuthenticatedClient(userId: string): Promise<gmail_v1.Gmail> {
    const connection = await prisma.emailAccountConnection.findFirst({
      where: { userId, provider: 'GMAIL' }
    });

    if (!connection) {
      throw new Error("No Gmail connection found for user");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_API_URL
        ? `${process.env.NEXT_PUBLIC_API_URL}/auth/google/callback`
        : "http://localhost:5000/api/v1/auth/google/callback"
    );

    const decryptedAccessToken = decryptToken(connection.encryptedAccessToken);
    const decryptedRefreshToken = decryptToken(connection.encryptedRefreshToken);

    oauth2Client.setCredentials({
      access_token: decryptedAccessToken,
      refresh_token: decryptedRefreshToken,
      expiry_date: connection.accessTokenExpiresAt.getTime(),
    });

    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
      }
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  async getConnection(userId: string) {
    return prisma.emailAccountConnection.findFirst({
      where: { userId, provider: 'GMAIL' }
    });
  }
}
