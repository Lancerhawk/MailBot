import { google, gmail_v1 } from "googleapis";
import { prisma } from "../../../lib/prisma";
import { decryptToken, encryptToken } from "../../../utils/encryption";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";

export class GmailClientService {
  async getAuthenticatedClient(userId: string): Promise<gmail_v1.Gmail> {
    const connection = await prisma.emailAccountConnection.findFirst({
      where: { userId, provider: 'GMAIL' }
    });

    if (!connection) {
      throw new Error("No Gmail connection found for user");
    }

    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      `${env.API_URL}/api/v1/auth/google/callback`
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
        try {
          const dataToUpdate: {
            encryptedAccessToken: string;
            accessTokenExpiresAt: Date;
            encryptedRefreshToken?: string;
          } = {
            encryptedAccessToken: encryptToken(tokens.access_token),
            accessTokenExpiresAt: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : new Date(Date.now() + 3600 * 1000),
          };

          if (tokens.refresh_token) {
            dataToUpdate.encryptedRefreshToken = encryptToken(tokens.refresh_token);
          }

          await prisma.emailAccountConnection.update({
            where: { id: connection.id },
            data: dataToUpdate,
          });

          logger.info({ connectionId: connection.id }, `[OAuth Refresh] Updated refreshed access token in DB`);
        } catch (error) {
          logger.error({ err: error, connectionId: connection.id }, `[OAuth Refresh Error] Failed to update token in DB`);
        }
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
