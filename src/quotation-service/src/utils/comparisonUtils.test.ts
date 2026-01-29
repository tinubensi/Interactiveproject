/**
 * comparisonUtils tests - formatLimitValue and extractors used by comparison PDF
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatLimitValue,
  extractNetworkProvider,
  extractGeographicalScope,
} from './comparisonUtils';

describe('comparisonUtils', () => {
  describe('formatLimitValue', () => {
    it('should return N/A for null or undefined', () => {
      assert.strictEqual(formatLimitValue(null, 'AED'), 'N/A');
      assert.strictEqual(formatLimitValue(undefined, 'AED'), 'N/A');
    });

    it('should return N/A for zero', () => {
      assert.strictEqual(formatLimitValue(0, 'AED'), 'N/A');
    });

    it('should format positive limit with currency', () => {
      assert.strictEqual(formatLimitValue(500000, 'AED'), 'AED 500,000');
      assert.strictEqual(formatLimitValue(1000, 'USD'), 'USD 1,000');
    });
  });

  describe('extractNetworkProvider', () => {
    it('should extract from plan.network', () => {
      const plan = {
        fullPlanData: {
          network: { networkName: 'Network A', tpa: 'TPA X' },
        },
      };
      assert.strictEqual(extractNetworkProvider(plan), 'Network A | TPA X');
    });

    it('should use fullPlanData when present', () => {
      const plan = {
        fullPlanData: { network: { networkName: 'Direct Billing' } },
      };
      assert.strictEqual(extractNetworkProvider(plan), 'Direct Billing');
    });

    it('should return N/A when no network data', () => {
      assert.strictEqual(extractNetworkProvider({}), 'N/A');
      assert.strictEqual(extractNetworkProvider({ fullPlanData: {} }), 'N/A');
    });
  });

  describe('extractGeographicalScope', () => {
    it('should extract from lobSpecificData.areaOfCover', () => {
      const plan = { fullPlanData: { lobSpecificData: { areaOfCover: 'UAE and GCC' } } };
      assert.strictEqual(extractGeographicalScope(plan), 'UAE and GCC');
    });

    it('should return UAE as default when no data', () => {
      assert.strictEqual(extractGeographicalScope({}), 'UAE');
      assert.strictEqual(extractGeographicalScope({ fullPlanData: {} }), 'UAE');
    });
  });
});
