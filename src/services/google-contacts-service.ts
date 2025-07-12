import { google, people_v1 } from 'googleapis';
import { createOAuth2Client } from '@/config/google-oauth';
import { AuthService } from './auth-service';

export interface Contact {
  resourceName?: string;
  etag?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  emailAddresses?: Array<{
    value: string;
    type?: string;
    formattedType?: string;
  }>;
  phoneNumbers?: Array<{
    value: string;
    type?: string;
    formattedType?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
    type?: string;
    formattedType?: string;
  }>;
  photos?: Array<{
    url: string;
    metadata?: {
      primary?: boolean;
      source?: {
        type?: string;
        id?: string;
      };
    };
  }>;
}

export class GoogleContactsService {
  private people: people_v1.People;
  private userEmail: string;

  constructor(userEmail: string) {
    this.userEmail = userEmail;
    this.people = google.people({ version: 'v1' });
  }

  private async getAuthenticatedClient() {
    const accessToken = await AuthService.getValidAccessToken(this.userEmail);

    if (!accessToken) {
      throw new Error('Unable to get valid access token');
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    return oauth2Client;
  }

  async listContacts(options?: {
    pageSize?: number;
    pageToken?: string;
    sortOrder?: 'LAST_MODIFIED_ASCENDING' | 'LAST_MODIFIED_DESCENDING' | 'FIRST_NAME_ASCENDING' | 'LAST_NAME_ASCENDING';
  }) {
    try {
      const auth = await this.getAuthenticatedClient();
      const response = await this.people.people.connections.list({
        auth,
        resourceName: 'people/me',
        pageSize: options?.pageSize || 50,
        pageToken: options?.pageToken,
        sortOrder: options?.sortOrder || 'LAST_MODIFIED_DESCENDING',
        personFields: 'names,emailAddresses,phoneNumbers,photos,organizations',
      });

      return {
        contacts: response.data.connections || [],
        nextPageToken: response.data.nextPageToken,
        totalPeople: response.data.totalPeople,
      };
    } catch (error) {
      console.error('Error listing contacts:', error);
      throw error;
    }
  }

  async searchContacts(query: string, options?: {
    pageSize?: number;
  }) {
    try {
      const auth = await this.getAuthenticatedClient();
      const response = await this.people.people.searchContacts({
        auth,
        query,
        pageSize: options?.pageSize || 25,
        readMask: 'names,emailAddresses,phoneNumbers,photos,organizations',
      });

      return response.data.results || [];
    } catch (error) {
      console.error('Error searching contacts:', error);
      throw error;
    }
  }

  async getContact(resourceName: string) {
    try {
      const auth = await this.getAuthenticatedClient();
      const response = await this.people.people.get({
        auth,
        resourceName,
        personFields: 'names,emailAddresses,phoneNumbers,photos,organizations,addresses,birthdays',
      });

      return response.data;
    } catch (error) {
      console.error('Error getting contact:', error);
      throw error;
    }
  }

  // Helper method to format a contact for easier use in UI
  formatContact(contact: people_v1.Schema$Person): Contact {
    const names = contact.names?.[0];
    const primaryEmail = contact.emailAddresses?.find(email => email.metadata?.primary) || contact.emailAddresses?.[0];
    const primaryPhone = contact.phoneNumbers?.find(phone => phone.metadata?.primary) || contact.phoneNumbers?.[0];
    const primaryOrg = contact.organizations?.[0];
    const primaryPhoto = contact.photos?.find(photo => photo.metadata?.primary) || contact.photos?.[0];

    return {
      resourceName: contact.resourceName,
      etag: contact.etag,
      displayName: names?.displayName,
      givenName: names?.givenName,
      familyName: names?.familyName,
      emailAddresses: contact.emailAddresses?.map(email => ({
        value: email.value || '',
        type: email.type,
        formattedType: email.formattedType,
      })),
      phoneNumbers: contact.phoneNumbers?.map(phone => ({
        value: phone.value || '',
        type: phone.type,
        formattedType: phone.formattedType,
      })),
      organizations: contact.organizations?.map(org => ({
        name: org.name,
        title: org.title,
        type: org.type,
        formattedType: org.formattedType,
      })),
      photos: contact.photos?.map(photo => ({
        url: photo.url || '',
        metadata: photo.metadata,
      })),
    };
  }
}