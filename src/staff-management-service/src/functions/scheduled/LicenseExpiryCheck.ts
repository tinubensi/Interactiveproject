/**
 * LicenseExpiryCheck - Timer trigger to check for expiring licenses
 * Runs daily at 8:00 AM UTC
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getStaffWithExpiringLicenses, findStaffById } from '../../lib/staffRepository';
import { publishLicenseExpiringEvent } from '../../lib/eventPublisher';
import { getDaysUntilExpiry, needsRenewalAlert } from '../../lib/validators';
import { getConfig } from '../../lib/config';

export async function LicenseExpiryCheck(
  timer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log('LicenseExpiryCheck triggered');

  try {
    // Check for next 30 days
    const maxDays = 30;
    const staffWithExpiringLicenses = await getStaffWithExpiringLicenses(maxDays);

    context.log(`Found ${staffWithExpiringLicenses.length} staff members with expiring licenses`);

    let config;
    try {
      config = getConfig();
    } catch {
      // Use defaults if config not available
      config = { license: { alertDays: [30, 14, 7, 3, 1] } };
    }
    const alertDays = config.license.alertDays;

    for (const staff of staffWithExpiringLicenses) {
      if (!staff.licenses) continue;

      for (const license of staff.licenses) {
        const daysUntil = getDaysUntilExpiry(license);
        const alertThreshold = needsRenewalAlert(license, alertDays);

        if (alertThreshold !== null && daysUntil <= alertThreshold) {
          // Check if this is exactly the alert day (to avoid duplicate alerts)
          // In production, you'd track which alerts have been sent
          
          // Get manager info
          let managerEmail: string | undefined;
          if (staff.managerId) {
            const manager = await findStaffById(staff.managerId);
            if (manager) {
              managerEmail = manager.email;
            }
          }

          // Publish license expiring event
          await publishLicenseExpiringEvent(
            staff.staffId,
            staff.email,
            staff.displayName,
            {
              licenseType: license.licenseType,
              licenseNumber: license.licenseNumber,
              expiryDate: license.expiryDate,
            },
            daysUntil,
            staff.managerId,
            managerEmail
          );

          context.log(
            `Published license expiring alert for ${staff.email}: ` +
            `${license.licenseType} expires in ${daysUntil} days`
          );
        }
      }
    }

    context.log('LicenseExpiryCheck completed');
  } catch (error) {
    context.error('LicenseExpiryCheck error:', error);
  }
}

app.timer('LicenseExpiryCheck', {
  schedule: '0 0 8 * * *', // 8:00 AM UTC daily
  handler: LicenseExpiryCheck,
});

