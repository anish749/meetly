import { createOAuth2Client } from '@/config/google-oauth';
import { AuthService } from './auth-service';

export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    open_now?: boolean;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
}

export interface PlacesSearchParams {
  location: string;
  radius: number;
  type?: string;
  keyword?: string;
  maxResults?: number;
}

export interface PlacesSearchResult {
  places: PlaceResult[];
  status: string;
}

export class GooglePlacesService {
  private userEmail: string;

  constructor(userEmail: string) {
    this.userEmail = userEmail;
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

  async nearbySearch(params: PlacesSearchParams): Promise<PlacesSearchResult> {
    try {
      // For simplicity, use text search which doesn't require geocoding
      // This provides similar results to nearby search
      const searchQuery =
        `${params.keyword || params.type || ''} near ${params.location}`.trim();
      return await this.textSearch(searchQuery);
    } catch (error) {
      console.error('Error searching nearby places:', error);
      throw error;
    }
  }

  async textSearch(
    query: string,
    location?: string,
    radius?: number
  ): Promise<PlacesSearchResult> {
    try {
      // For this demo, we'll create a simplified response
      // In a real implementation, you would use the correct Google Places API
      console.log(`Searching for: ${query}`, { location, radius });

      // Return mock data in the correct format for now
      // This maintains the interface while we work on proper API integration
      return {
        places: this.generateMockPlaces(query),
        status: 'OK',
      };
    } catch (error) {
      console.error('Error searching places by text:', error);
      throw error;
    }
  }

  private generateMockPlaces(query: string): PlaceResult[] {
    // Generate realistic mock data based on the query
    const basePlaces = [
      {
        place_id: 'place_1',
        name: 'Coffee Bean & Tea Leaf',
        formatted_address: '123 Main St, Downtown',
        rating: 4.5,
        user_ratings_total: 150,
        price_level: 2,
        types: ['cafe', 'food', 'point_of_interest', 'establishment'],
        geometry: { location: { lat: 40.7589, lng: -73.9851 } },
        opening_hours: { open_now: true },
        photos: [{ photo_reference: 'photo_ref_1', height: 400, width: 600 }],
      },
      {
        place_id: 'place_2',
        name: 'Business Lunch Bistro',
        formatted_address: '456 Corporate Ave, Business District',
        rating: 4.3,
        user_ratings_total: 200,
        price_level: 3,
        types: ['restaurant', 'food', 'point_of_interest', 'establishment'],
        geometry: { location: { lat: 40.7505, lng: -73.9934 } },
        opening_hours: { open_now: true },
      },
      {
        place_id: 'place_3',
        name: 'Meeting Room Co-working',
        formatted_address: '789 Startup Lane, Tech Hub',
        rating: 4.7,
        user_ratings_total: 85,
        types: ['establishment', 'point_of_interest'],
        geometry: { location: { lat: 40.7614, lng: -73.9776 } },
        opening_hours: { open_now: true },
      },
    ];

    // Filter based on query terms
    const queryLower = query.toLowerCase();
    return basePlaces.filter(
      (place) =>
        place.name.toLowerCase().includes(queryLower) ||
        place.types.some((type) =>
          queryLower.includes(type.replace('_', ' '))
        ) ||
        queryLower
          .split(' ')
          .some(
            (term) =>
              place.name.toLowerCase().includes(term) ||
              place.types.some((type) => type.includes(term))
          )
    );
  }

  private mapPlaceResult(place: {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    types?: string[];
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    opening_hours?: {
      open_now?: boolean;
    };
    photos?: Array<{
      photo_reference: string;
      height: number;
      width: number;
    }>;
  }): PlaceResult {
    return {
      place_id: place.place_id || '',
      name: place.name || '',
      formatted_address: place.formatted_address || '',
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      types: place.types || [],
      geometry: {
        location: {
          lat: place.geometry?.location?.lat || 0,
          lng: place.geometry?.location?.lng || 0,
        },
      },
      opening_hours: place.opening_hours
        ? {
            open_now: place.opening_hours.open_now,
          }
        : undefined,
      photos: place.photos?.map(
        (photo: {
          photo_reference: string;
          height: number;
          width: number;
        }) => ({
          photo_reference: photo.photo_reference,
          height: photo.height,
          width: photo.width,
        })
      ),
    };
  }

  async getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
    try {
      // For this demo, return mock place details
      // In a real implementation, you would call the Google Places API
      console.log(`Getting details for place: ${placeId}`);

      const mockPlace = {
        place_id: placeId,
        name: 'Sample Place',
        formatted_address: '123 Sample St, Sample City',
        rating: 4.2,
        user_ratings_total: 100,
        price_level: 2,
        types: ['establishment', 'point_of_interest'],
        geometry: { location: { lat: 40.7505, lng: -73.9934 } },
        opening_hours: { open_now: true },
      };

      return this.mapPlaceResult(mockPlace);
    } catch (error) {
      console.error('Error getting place details:', error);
      throw error;
    }
  }
}
