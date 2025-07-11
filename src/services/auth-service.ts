import { adminDb } from '@/config/firebase-admin';
import { createOAuth2Client } from '@/config/google-oauth';
import { cookies } from 'next/headers';

interface UserTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiryDate: number | null;
}

interface User {
  email: string;
  name: string | null;
  picture: string | null;
  googleId: string;
  sessionToken: string;
  createdAt: string;
  updatedAt: string;
}

export class AuthService {
  static async getCurrentUser(): Promise<User | null> {
    try {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get('session_token')?.value;

      if (!sessionToken) {
        return null;
      }

      const usersSnapshot = await adminDb
        .collection('users')
        .where('sessionToken', '==', sessionToken)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        return null;
      }

      const userDoc = usersSnapshot.docs[0];
      return userDoc.data() as User;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async getUserTokens(email: string): Promise<UserTokens | null> {
    try {
      const userDoc = await adminDb.collection('users').doc(email).get();

      if (!userDoc.exists) {
        return null;
      }

      const data = userDoc.data();
      return {
        accessToken: data?.accessToken || null,
        refreshToken: data?.refreshToken || null,
        expiryDate: data?.expiryDate || null,
      };
    } catch (error) {
      console.error('Error getting user tokens:', error);
      return null;
    }
  }

  static async updateUserTokens(
    email: string,
    tokens: Partial<UserTokens>
  ): Promise<void> {
    try {
      await adminDb
        .collection('users')
        .doc(email)
        .update({
          ...tokens,
          updatedAt: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error updating user tokens:', error);
      throw error;
    }
  }

  static async refreshAccessToken(email: string): Promise<string | null> {
    try {
      const tokens = await this.getUserTokens(email);

      if (!tokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({
        refresh_token: tokens.refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update stored tokens
      await this.updateUserTokens(email, {
        accessToken: credentials.access_token || null,
        expiryDate: credentials.expiry_date || null,
      });

      return credentials.access_token || null;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return null;
    }
  }

  static async getValidAccessToken(email: string): Promise<string | null> {
    try {
      const tokens = await this.getUserTokens(email);

      if (!tokens?.accessToken || !tokens?.expiryDate) {
        return await this.refreshAccessToken(email);
      }

      // Check if token is expired (with 5 minute buffer)
      const now = Date.now();
      const expiryWithBuffer = tokens.expiryDate - 5 * 60 * 1000;

      if (now >= expiryWithBuffer) {
        return await this.refreshAccessToken(email);
      }

      return tokens.accessToken;
    } catch (error) {
      console.error('Error getting valid access token:', error);
      return null;
    }
  }
}
