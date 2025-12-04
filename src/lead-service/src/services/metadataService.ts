/**
 * Metadata Service
 * Handles metadata for all LOBs (pet types, breeds, emirates, etc.)
 * Reference: Petli metadata endpoints
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { PetType, Breed, BreedType, GenderType, Emirate } from '../models/metadata';

class MetadataService {
  private client: CosmosClient;
  private database: Database;
  private metadataContainer: Container;

  constructor() {
    // Support both connection string (Azure) and separate endpoint/key (emulator)
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const endpoint = process.env.COSMOS_DB_ENDPOINT;
    const key = process.env.COSMOS_DB_KEY;
    const databaseName = process.env.COSMOS_DB_NAME || 'lead-service-db';

    if (connectionString) {
      // Using Azure Cosmos DB (production/cloud)
      this.client = new CosmosClient(connectionString);
    } else if (endpoint && key) {
      // Using emulator with separate endpoint/key
      if (endpoint && (endpoint.includes('localhost') || endpoint.includes('127.0.0.1'))) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }
      this.client = new CosmosClient({ endpoint, key });
    } else {
      throw new Error('COSMOS_CONNECTION_STRING or (COSMOS_DB_ENDPOINT + COSMOS_DB_KEY) must be set');
    }

    this.database = this.client.database(databaseName);
    this.metadataContainer = this.database.container('metadata');
  }

  /**
   * Initialize metadata container
   */
  async initialize(): Promise<void> {
    await this.database.containers.createIfNotExists({
      id: 'metadata',
      partitionKey: { paths: ['/type'] } // type: 'petType', 'breed', 'emirate', etc.
    });
  }

  // ==================== PET TYPES ====================

  async getPetTypes(): Promise<PetType[]> {
    const query = {
      query: 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true ORDER BY c.name ASC',
      parameters: [{ name: '@type', value: 'petType' }]
    };
    const { resources } = await this.metadataContainer.items.query<any>(query).fetchAll();
    return resources.map(r => ({ ...r, type: undefined }));
  }

  async seedPetTypes(): Promise<void> {
    const petTypes = [
      { id: 'pet-type-1', type: 'petType', name: 'Dog', code: 'dog', icon: '🐕', isActive: true },
      { id: 'pet-type-2', type: 'petType', name: 'Cat', code: 'cat', icon: '🐈', isActive: true }
    ];

    for (const petType of petTypes) {
      await this.metadataContainer.items.upsert(petType);
    }
  }

  // ==================== BREED TYPES ====================

  async getBreedTypes(petTypeId?: string): Promise<BreedType[]> {
    let query;
    if (petTypeId) {
      query = {
        query: 'SELECT * FROM c WHERE c.type = @type AND c.petTypeId = @petTypeId AND c.isActive = true ORDER BY c.name ASC',
        parameters: [
          { name: '@type', value: 'breedType' },
          { name: '@petTypeId', value: petTypeId }
        ]
      };
    } else {
      query = {
        query: 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true ORDER BY c.name ASC',
        parameters: [{ name: '@type', value: 'breedType' }]
      };
    }

    const { resources } = await this.metadataContainer.items.query<any>(query).fetchAll();
    return resources.map(r => ({ ...r, type: undefined }));
  }

  async seedBreedTypes(): Promise<void> {
    const breedTypes = [
      // Dog breed types
      { id: 'breed-type-1', type: 'breedType', name: 'Small', petTypeId: 'pet-type-1', isActive: true },
      { id: 'breed-type-2', type: 'breedType', name: 'Medium', petTypeId: 'pet-type-1', isActive: true },
      { id: 'breed-type-3', type: 'breedType', name: 'Large', petTypeId: 'pet-type-1', isActive: true },
      { id: 'breed-type-4', type: 'breedType', name: 'Giant', petTypeId: 'pet-type-1', isActive: true },
      // Cat breed types
      { id: 'breed-type-5', type: 'breedType', name: 'Domestic', petTypeId: 'pet-type-2', isActive: true },
      { id: 'breed-type-6', type: 'breedType', name: 'Pure Breed', petTypeId: 'pet-type-2', isActive: true }
    ];

    for (const breedType of breedTypes) {
      await this.metadataContainer.items.upsert(breedType);
    }
  }

  // ==================== BREEDS ====================

  async getBreeds(petTypeId?: string, breedTypeId?: string, search?: string): Promise<Breed[]> {
    let queryText = 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true';
    const parameters: Array<{ name: string; value: any }> = [{ name: '@type', value: 'breed' }];

    if (petTypeId) {
      queryText += ' AND c.petTypeId = @petTypeId';
      parameters.push({ name: '@petTypeId', value: petTypeId });
    }

    if (breedTypeId) {
      queryText += ' AND c.breedTypeId = @breedTypeId';
      parameters.push({ name: '@breedTypeId', value: breedTypeId });
    }

    if (search) {
      queryText += ' AND CONTAINS(LOWER(c.name), LOWER(@search))';
      parameters.push({ name: '@search', value: search });
    }

    queryText += ' ORDER BY c.name ASC';

    const { resources } = await this.metadataContainer.items.query<any>({ query: queryText, parameters }).fetchAll();
    return resources.map(r => ({ ...r, type: undefined }));
  }

  async seedBreeds(): Promise<void> {
    const breeds = [
      // Dog breeds (Small)
      { id: 'breed-1', type: 'breed', name: 'Chihuahua', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-1', isPureBreed: true, isActive: true },
      { id: 'breed-2', type: 'breed', name: 'Pomeranian', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-1', isPureBreed: true, isActive: true },
      { id: 'breed-3', type: 'breed', name: 'Pug', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-1', isPureBreed: true, isActive: true },
      // Dog breeds (Medium)
      { id: 'breed-4', type: 'breed', name: 'Beagle', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-2', isPureBreed: true, isActive: true },
      { id: 'breed-5', type: 'breed', name: 'Cocker Spaniel', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-2', isPureBreed: true, isActive: true },
      { id: 'breed-6', type: 'breed', name: 'Bulldog', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-2', isPureBreed: true, isActive: true },
      // Dog breeds (Large)
      { id: 'breed-7', type: 'breed', name: 'German Shepherd', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-3', isPureBreed: true, isActive: true },
      { id: 'breed-8', type: 'breed', name: 'Golden Retriever', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-3', isPureBreed: true, isActive: true },
      { id: 'breed-9', type: 'breed', name: 'Labrador Retriever', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-3', isPureBreed: true, isActive: true },
      // Dog breeds (Giant)
      { id: 'breed-10', type: 'breed', name: 'Great Dane', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-4', isPureBreed: true, isActive: true },
      { id: 'breed-11', type: 'breed', name: 'Saint Bernard', petTypeId: 'pet-type-1', breedTypeId: 'breed-type-4', isPureBreed: true, isActive: true },
      // Cat breeds
      { id: 'breed-12', type: 'breed', name: 'Domestic Shorthair', petTypeId: 'pet-type-2', breedTypeId: 'breed-type-5', isPureBreed: false, isActive: true },
      { id: 'breed-13', type: 'breed', name: 'Domestic Longhair', petTypeId: 'pet-type-2', breedTypeId: 'breed-type-5', isPureBreed: false, isActive: true },
      { id: 'breed-14', type: 'breed', name: 'Persian', petTypeId: 'pet-type-2', breedTypeId: 'breed-type-6', isPureBreed: true, isActive: true },
      { id: 'breed-15', type: 'breed', name: 'Siamese', petTypeId: 'pet-type-2', breedTypeId: 'breed-type-6', isPureBreed: true, isActive: true },
      { id: 'breed-16', type: 'breed', name: 'Maine Coon', petTypeId: 'pet-type-2', breedTypeId: 'breed-type-6', isPureBreed: true, isActive: true },
      { id: 'breed-17', type: 'breed', name: 'British Shorthair', petTypeId: 'pet-type-2', breedTypeId: 'breed-type-6', isPureBreed: true, isActive: true }
    ];

    for (const breed of breeds) {
      await this.metadataContainer.items.upsert(breed);
    }
  }

  // ==================== GENDER TYPES ====================

  async getGenderTypes(): Promise<GenderType[]> {
    const query = {
      query: 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true ORDER BY c.name ASC',
      parameters: [{ name: '@type', value: 'genderType' }]
    };
    const { resources } = await this.metadataContainer.items.query<any>(query).fetchAll();
    return resources.map(r => ({ ...r, type: undefined }));
  }

  async seedGenderTypes(): Promise<void> {
    const genderTypes = [
      { id: 'gender-1', type: 'genderType', name: 'Male', code: 'male', isActive: true },
      { id: 'gender-2', type: 'genderType', name: 'Female', code: 'female', isActive: true }
    ];

    for (const genderType of genderTypes) {
      await this.metadataContainer.items.upsert(genderType);
    }
  }

  // ==================== EMIRATES ====================

  async getEmirates(): Promise<Emirate[]> {
    const query = {
      query: 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true ORDER BY c.name ASC',
      parameters: [{ name: '@type', value: 'emirate' }]
    };
    const { resources } = await this.metadataContainer.items.query<any>(query).fetchAll();
    return resources.map(r => ({ ...r, type: undefined }));
  }

  async seedEmirates(): Promise<void> {
    const emirates = [
      { id: 'emirate-1', type: 'emirate', name: 'Abu Dhabi', code: 'AUH', isActive: true },
      { id: 'emirate-2', type: 'emirate', name: 'Dubai', code: 'DXB', isActive: true },
      { id: 'emirate-3', type: 'emirate', name: 'Sharjah', code: 'SHJ', isActive: true },
      { id: 'emirate-4', type: 'emirate', name: 'Ajman', code: 'AJM', isActive: true },
      { id: 'emirate-5', type: 'emirate', name: 'Umm Al Quwain', code: 'UAQ', isActive: true },
      { id: 'emirate-6', type: 'emirate', name: 'Ras Al Khaimah', code: 'RAK', isActive: true },
      { id: 'emirate-7', type: 'emirate', name: 'Fujairah', code: 'FUJ', isActive: true }
    ];

    for (const emirate of emirates) {
      await this.metadataContainer.items.upsert(emirate);
    }
  }

  /**
   * Seed all metadata
   */
  async seedAllMetadata(): Promise<void> {
    await this.initialize();
    await this.seedPetTypes();
    await this.seedBreedTypes();
    await this.seedBreeds();
    await this.seedGenderTypes();
    await this.seedEmirates();
    console.log('All metadata seeded successfully');
  }
}

export const metadataService = new MetadataService();


