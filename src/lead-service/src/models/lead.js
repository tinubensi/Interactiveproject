"use strict";
/**
 * Lead Model - Supports ALL Lines of Business
 * Designed to be LOB-agnostic with flexible data storage
 * Reference: Petli lead.js (adapted for multi-LOB support)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMedicalData = isMedicalData;
exports.isMotorData = isMotorData;
exports.isGeneralData = isGeneralData;
exports.isMarineData = isMarineData;
/**
 * Helper type guards
 */
function isMedicalData(lobData) {
    return 'petName' in lobData || 'dateOfBirth' in lobData;
}
function isMotorData(lobData) {
    return 'vehicleType' in lobData || 'make' in lobData;
}
function isGeneralData(lobData) {
    return 'propertyType' in lobData || 'businessType' in lobData;
}
function isMarineData(lobData) {
    return 'cargoType' in lobData || 'vesselType' in lobData || 'yachtType' in lobData;
}
