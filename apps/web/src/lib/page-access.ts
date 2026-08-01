import {redirect} from 'next/navigation';

import {
  AuthenticationRequiredError,
  EmailNotAllowedError,
  HouseholdRequiredError,
  requireAllowedUser,
  requireHouseholdAccess,
} from './auth';

export async function getAllowedPageUser() {
  try {
    return await requireAllowedUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect('/sign-in');
    if (error instanceof EmailNotAllowedError) redirect('/access-denied');
    throw error;
  }
}

export async function getHouseholdPageContext(requiredRole: 'owner' | 'member' = 'member') {
  try {
    return await requireHouseholdAccess(requiredRole);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect('/sign-in');
    if (error instanceof EmailNotAllowedError) redirect('/access-denied');
    if (error instanceof HouseholdRequiredError) redirect('/household/setup');
    throw error;
  }
}
