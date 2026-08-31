import {Button} from '@astryxdesign/core/Button';
import {Grid} from '@astryxdesign/core/Grid';
import {Link} from '@astryxdesign/core/Link';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

import type {CategoryAnalyticsRow} from '@/lib/category-analytics';
import {formatMinorCurrencySummary} from '@/lib/format';

export function CategoryAnalyticsItem({
  row,
  transactionsHref,
  onEdit,
  onDelete,
}: {
  row: CategoryAnalyticsRow;
  transactionsHref: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const budget = row.category.budgetMinor;
  const budgetLimit = row.budgetLimitMinor;
  const status = row.isUncategorized
    ? {label: row.spendingMinor > 0 ? 'Needs categorization' : 'No uncategorized activity', variant: row.spendingMinor > 0 ? 'warning' as const : 'success' as const}
    : row.isNonSpending
      ? null
      : row.budgetStatus ?? {label: 'No monthly budget', variant: 'neutral' as const};
  const remainingCopy = row.remainingMinor !== null && row.remainingMinor < 0
    ? `${formatMinorCurrencySummary(Math.abs(row.remainingMinor), 'INR')} over budget`
    : `${formatMinorCurrencySummary(row.remainingMinor ?? 0, 'INR')} remaining`;
  const monthlyBudgetCopy = row.isNonSpending
    ? 'Not included in budgets'
    : row.isUncategorized
      ? 'Needs a category'
      : budget === null
        ? 'No monthly budget'
        : `${formatMinorCurrencySummary(budget, 'INR')} / month`;

  return (
    <VStack as="li" className="category-analytics-item" paddingBlock={3}>
      <Grid columns={{minWidth: 220, max: 4, repeat: 'fit'}} gap={3} align="center" width="100%">
        <VStack gap={1}>
          <HStack gap={2} vAlign="center">
            {row.category.icon ? <Text aria-hidden="true">{row.category.icon}</Text> : null}
            <Text weight="medium">{row.category.name}</Text>
          </HStack>
          {status ? <HStack gap={1} vAlign="center"><StatusDot label={status.label} variant={status.variant} /><Text type="supporting" color="secondary">{status.label}</Text></HStack> : null}
        </VStack>
        <VStack gap={0}>
          <Text type="supporting" color="secondary">Spending</Text>
          <Text hasTabularNumbers>{formatMinorCurrencySummary(row.spendingMinor, 'INR')}</Text>
          <Text type="supporting" color="secondary">{row.transactionCount} {row.transactionCount === 1 ? 'transaction' : 'transactions'}</Text>
        </VStack>
        <VStack gap={1}>
          <Text type="supporting" color="secondary">Budget health</Text>
          <Text hasTabularNumbers maxLines={1}>{monthlyBudgetCopy}</Text>
          {budgetLimit !== null && !row.isNonSpending && !row.isUncategorized ? (
            <ProgressBar
              label={`${row.category.name}: ${row.budgetStatus?.percent ?? 0}% of the selected-period budget used; ${remainingCopy}`}
              value={Math.min(row.spendingMinor, budgetLimit)}
              max={budgetLimit || 1}
              variant={row.budgetStatus?.label === 'Over budget' ? 'warning' : 'accent'}
              isLabelHidden
              hasValueLabel
              formatValueLabel={() => `${row.budgetStatus?.percent ?? 0}% · ${remainingCopy}`}
            />
          ) : null}
        </VStack>
        <VStack gap={1}>
          <Text type="supporting" color="secondary">Actions</Text>
          <HStack gap={2} wrap="wrap">
            <Link href={transactionsHref} isStandalone>View transactions</Link>
            <Button label="Edit" variant="secondary" size="sm" onClick={onEdit} />
            <Button label="Delete" variant="ghost" size="sm" onClick={onDelete} isDisabled={row.isUncategorized} tooltip={row.isUncategorized ? 'Required as the fallback category' : undefined} />
          </HStack>
        </VStack>
      </Grid>
    </VStack>
  );
}
