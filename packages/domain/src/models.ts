import {z} from 'zod';

export const personTypes = ['member', 'dependent', 'other'] as const;
export const accountTypes = ['current', 'savings', 'credit-card', 'cash', 'wallet', 'other'] as const;

const displayName = z.string().trim().min(1).max(100);
const optionalMaskedReference = z
  .string()
  .trim()
  .max(32)
  .refine(
    (value) => /[xX*•]/u.test(value) || /\D/u.test(value) || value.replace(/\D/gu, '').length <= 4,
    'Store only a masked reference or the last four digits',
  )
  .optional()
  .transform((value) => value || undefined);

export const createHouseholdSchema = z.object({
  name: displayName,
  baseCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  financialYearStartMonth: z.coerce.number().int().min(1).max(12),
});

export const createPersonSchema = z.object({
  displayName,
  type: z.enum(personTypes),
});

export const createFinancialAccountSchema = z
  .object({
    institutionName: displayName,
    displayName,
    accountType: z.enum(accountTypes),
    maskedReference: optionalMaskedReference,
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    primaryPersonId: z.uuid(),
    joint: z.boolean().default(false),
    additionalPersonIds: z.array(z.uuid()).max(12).default([]),
  })
  .superRefine((account, context) => {
    if (account.joint && account.additionalPersonIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A joint account requires at least one additional holder',
        path: ['additionalPersonIds'],
      });
    }

    if (!account.joint && account.additionalPersonIds.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Additional account holders require a joint account',
        path: ['additionalPersonIds'],
      });
    }

    if (account.additionalPersonIds.includes(account.primaryPersonId)) {
      context.addIssue({
        code: 'custom',
        message: 'The primary person cannot also be an additional holder',
        path: ['additionalPersonIds'],
      });
    }
  });

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type CreateFinancialAccountInput = z.infer<typeof createFinancialAccountSchema>;
