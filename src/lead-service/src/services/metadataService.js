"use strict";
/**
 * Metadata Service
 * Handles metadata for all LOBs (pet types, breeds, emirates, etc.)
 * Reference: Petli metadata endpoints
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataService = void 0;
var cosmos_1 = require("@azure/cosmos");
var MetadataService = /** @class */ (function () {
    function MetadataService() {
        // Support both connection string (Azure) and separate endpoint/key (emulator)
        var connectionString = process.env.COSMOS_CONNECTION_STRING;
        var endpoint = process.env.COSMOS_DB_ENDPOINT;
        var key = process.env.COSMOS_DB_KEY;
        var databaseName = process.env.COSMOS_DB_NAME || 'lead-service-db';
        if (connectionString) {
            // Using Azure Cosmos DB (production/cloud)
            this.client = new cosmos_1.CosmosClient(connectionString);
        }
        else if (endpoint && key) {
            // Using emulator with separate endpoint/key
            if (endpoint && (endpoint.includes('localhost') || endpoint.includes('127.0.0.1'))) {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
            }
            this.client = new cosmos_1.CosmosClient({ endpoint: endpoint, key: key });
        }
        else {
            throw new Error('COSMOS_CONNECTION_STRING or (COSMOS_DB_ENDPOINT + COSMOS_DB_KEY) must be set');
        }
        this.database = this.client.database(databaseName);
        this.metadataContainer = this.database.container('metadata');
    }
    /**
     * Initialize metadata container
     */
    MetadataService.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.database.containers.createIfNotExists({
                            id: 'metadata',
                            partitionKey: { paths: ['/type'] } // type: 'petType', 'breed', 'emirate', etc.
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // ==================== PET TYPES ====================
    MetadataService.prototype.getPetTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query, resources;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = {
                            query: 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true ORDER BY c.name ASC',
                            parameters: [{ name: '@type', value: 'petType' }]
                        };
                        return [4 /*yield*/, this.metadataContainer.items.query(query).fetchAll()];
                    case 1:
                        resources = (_a.sent()).resources;
                        return [2 /*return*/, resources.map(function (r) { return (__assign(__assign({}, r), { type: undefined })); })];
                }
            });
        });
    };
    MetadataService.prototype.seedPetTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var petTypes, _i, petTypes_1, petType;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        petTypes = [
                            { id: 'pet-type-1', type: 'petType', name: 'Dog', code: 'dog', icon: '🐕', isActive: true },
                            { id: 'pet-type-2', type: 'petType', name: 'Cat', code: 'cat', icon: '🐈', isActive: true }
                        ];
                        _i = 0, petTypes_1 = petTypes;
                        _a.label = 1;
                    case 1:
                        if (!(_i < petTypes_1.length)) return [3 /*break*/, 4];
                        petType = petTypes_1[_i];
                        return [4 /*yield*/, this.metadataContainer.items.upsert(petType)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== BREED TYPES ====================
    MetadataService.prototype.getBreedTypes = function (petTypeId) {
        return __awaiter(this, void 0, void 0, function () {
            var query, resources;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (petTypeId) {
                            query = {
                                query: 'SELECT * FROM c WHERE c.type = @type AND c.petTypeId = @petTypeId AND c.isActive = true ORDER BY c.name ASC',
                                parameters: [
                                    { name: '@type', value: 'breedType' },
                                    { name: '@petTypeId', value: petTypeId }
                                ]
                            };
                        }
                        else {
                            query = {
                                query: 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true ORDER BY c.name ASC',
                                parameters: [{ name: '@type', value: 'breedType' }]
                            };
                        }
                        return [4 /*yield*/, this.metadataContainer.items.query(query).fetchAll()];
                    case 1:
                        resources = (_a.sent()).resources;
                        return [2 /*return*/, resources.map(function (r) { return (__assign(__assign({}, r), { type: undefined })); })];
                }
            });
        });
    };
    MetadataService.prototype.seedBreedTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var breedTypes, _i, breedTypes_1, breedType;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        breedTypes = [
                            // Dog breed types
                            { id: 'breed-type-1', type: 'breedType', name: 'Small', petTypeId: 'pet-type-1', isActive: true },
                            { id: 'breed-type-2', type: 'breedType', name: 'Medium', petTypeId: 'pet-type-1', isActive: true },
                            { id: 'breed-type-3', type: 'breedType', name: 'Large', petTypeId: 'pet-type-1', isActive: true },
                            { id: 'breed-type-4', type: 'breedType', name: 'Giant', petTypeId: 'pet-type-1', isActive: true },
                            // Cat breed types
                            { id: 'breed-type-5', type: 'breedType', name: 'Domestic', petTypeId: 'pet-type-2', isActive: true },
                            { id: 'breed-type-6', type: 'breedType', name: 'Pure Breed', petTypeId: 'pet-type-2', isActive: true }
                        ];
                        _i = 0, breedTypes_1 = breedTypes;
                        _a.label = 1;
                    case 1:
                        if (!(_i < breedTypes_1.length)) return [3 /*break*/, 4];
                        breedType = breedTypes_1[_i];
                        return [4 /*yield*/, this.metadataContainer.items.upsert(breedType)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== BREEDS ====================
    MetadataService.prototype.getBreeds = function (petTypeId, breedTypeId, search) {
        return __awaiter(this, void 0, void 0, function () {
            var queryText, parameters, resources;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryText = 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true';
                        parameters = [{ name: '@type', value: 'breed' }];
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
                        return [4 /*yield*/, this.metadataContainer.items.query({ query: queryText, parameters: parameters }).fetchAll()];
                    case 1:
                        resources = (_a.sent()).resources;
                        return [2 /*return*/, resources.map(function (r) { return (__assign(__assign({}, r), { type: undefined })); })];
                }
            });
        });
    };
    MetadataService.prototype.seedBreeds = function () {
        return __awaiter(this, void 0, void 0, function () {
            var breeds, _i, breeds_1, breed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        breeds = [
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
                        _i = 0, breeds_1 = breeds;
                        _a.label = 1;
                    case 1:
                        if (!(_i < breeds_1.length)) return [3 /*break*/, 4];
                        breed = breeds_1[_i];
                        return [4 /*yield*/, this.metadataContainer.items.upsert(breed)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== GENDER TYPES ====================
    MetadataService.prototype.getGenderTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query, resources;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = {
                            query: 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true ORDER BY c.name ASC',
                            parameters: [{ name: '@type', value: 'genderType' }]
                        };
                        return [4 /*yield*/, this.metadataContainer.items.query(query).fetchAll()];
                    case 1:
                        resources = (_a.sent()).resources;
                        return [2 /*return*/, resources.map(function (r) { return (__assign(__assign({}, r), { type: undefined })); })];
                }
            });
        });
    };
    MetadataService.prototype.seedGenderTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var genderTypes, _i, genderTypes_1, genderType;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        genderTypes = [
                            { id: 'gender-1', type: 'genderType', name: 'Male', code: 'male', isActive: true },
                            { id: 'gender-2', type: 'genderType', name: 'Female', code: 'female', isActive: true }
                        ];
                        _i = 0, genderTypes_1 = genderTypes;
                        _a.label = 1;
                    case 1:
                        if (!(_i < genderTypes_1.length)) return [3 /*break*/, 4];
                        genderType = genderTypes_1[_i];
                        return [4 /*yield*/, this.metadataContainer.items.upsert(genderType)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== EMIRATES ====================
    MetadataService.prototype.getEmirates = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query, resources;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = {
                            query: 'SELECT * FROM c WHERE c.type = @type AND c.isActive = true ORDER BY c.name ASC',
                            parameters: [{ name: '@type', value: 'emirate' }]
                        };
                        return [4 /*yield*/, this.metadataContainer.items.query(query).fetchAll()];
                    case 1:
                        resources = (_a.sent()).resources;
                        return [2 /*return*/, resources.map(function (r) { return (__assign(__assign({}, r), { type: undefined })); })];
                }
            });
        });
    };
    MetadataService.prototype.seedEmirates = function () {
        return __awaiter(this, void 0, void 0, function () {
            var emirates, _i, emirates_1, emirate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        emirates = [
                            { id: 'emirate-1', type: 'emirate', name: 'Abu Dhabi', code: 'AUH', isActive: true },
                            { id: 'emirate-2', type: 'emirate', name: 'Dubai', code: 'DXB', isActive: true },
                            { id: 'emirate-3', type: 'emirate', name: 'Sharjah', code: 'SHJ', isActive: true },
                            { id: 'emirate-4', type: 'emirate', name: 'Ajman', code: 'AJM', isActive: true },
                            { id: 'emirate-5', type: 'emirate', name: 'Umm Al Quwain', code: 'UAQ', isActive: true },
                            { id: 'emirate-6', type: 'emirate', name: 'Ras Al Khaimah', code: 'RAK', isActive: true },
                            { id: 'emirate-7', type: 'emirate', name: 'Fujairah', code: 'FUJ', isActive: true }
                        ];
                        _i = 0, emirates_1 = emirates;
                        _a.label = 1;
                    case 1:
                        if (!(_i < emirates_1.length)) return [3 /*break*/, 4];
                        emirate = emirates_1[_i];
                        return [4 /*yield*/, this.metadataContainer.items.upsert(emirate)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Seed all metadata
     */
    MetadataService.prototype.seedAllMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.seedPetTypes()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.seedBreedTypes()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.seedBreeds()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this.seedGenderTypes()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, this.seedEmirates()];
                    case 6:
                        _a.sent();
                        console.log('All metadata seeded successfully');
                        return [2 /*return*/];
                }
            });
        });
    };
    return MetadataService;
}());
exports.metadataService = new MetadataService();
