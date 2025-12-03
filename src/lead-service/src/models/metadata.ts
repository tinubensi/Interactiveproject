/**
 * Metadata Models
 * Reference: Petli metadata models (emirates, pet_types, breeds, etc.)
 */

/**
 * Emirate Model
 */
export interface Emirate {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

/**
 * Pet Type Model (for Medical LOB)
 */
export interface PetType {
  id: string;
  name: string; // "Dog", "Cat"
  code: string; // "dog", "cat"
  icon?: string;
  isActive: boolean;
}

/**
 * Breed Type Model
 */
export interface BreedType {
  id: string;
  name: string;
  petTypeId: string; // Reference to PetType
  isActive: boolean;
}

/**
 * Breed Model
 */
export interface Breed {
  id: string;
  name: string;
  petTypeId: string; // Reference to PetType
  breedTypeId?: string; // Reference to BreedType
  isPureBreed: boolean;
  isActive: boolean;
}

/**
 * Gender Type Model
 */
export interface GenderType {
  id: string;
  name: string; // "Male", "Female"
  code: string; // "male", "female"
  isActive: boolean;
}

/**
 * Vehicle Make Model (for Motor LOB)
 */
export interface VehicleMake {
  id: string;
  name: string; // "Toyota", "BMW", etc.
  code: string;
  isPopular: boolean;
  isActive: boolean;
}

/**
 * Vehicle Model
 */
export interface VehicleModel {
  id: string;
  name: string;
  makeId: string; // Reference to VehicleMake
  year: number;
  isActive: boolean;
}

/**
 * Property Type Model (for General LOB)
 */
export interface PropertyType {
  id: string;
  name: string; // "Residential", "Commercial", "Industrial"
  code: string;
  description?: string;
  isActive: boolean;
}

/**
 * Vessel Type Model (for Marine LOB)
 */
export interface VesselType {
  id: string;
  name: string; // "Cargo Ship", "Tanker", "Yacht", etc.
  code: string;
  category: 'cargo' | 'hull' | 'yacht' | 'other';
  description?: string;
  isActive: boolean;
}

/**
 * Source Model (Lead source)
 */
export interface Source {
  id: string;
  name: string; // "Website", "Referral", "Walk-in", etc.
  code: string;
  isActive: boolean;
}


