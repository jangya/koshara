import {Banner} from '@astryxdesign/core/Banner';
import {Heading} from '@astryxdesign/core/Heading';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

import {formatMinorCurrencySummary} from '@/lib/format';
import type {AttentionGroup} from '@/lib/category-analytics';

export function DashboardAttention({
  period,
  needsReview,
  uncategorized,
  combinedCount,
  needsReviewHref,
  uncategorizedHref,
}: {
  period: string;
  needsReview: AttentionGroup;
  uncategorized: AttentionGroup;
  combinedCount: number;
  needsReviewHref: string;
  uncategorizedHref: string;
}) {
  if (combinedCount === 0) {
    return (
      <Section>
        <VStack gap={3}>
          <Heading level={2}>Needs attention</Heading>
          <Banner status="success" title={`All transactions reviewed for ${period}`} description="No uncertain or uncategorized transactions need action in this period." />
        </VStack>
      </Section>
    );
  }

  return (
    <Section>
      <VStack gap={3}>
        <HStack gap={3} vAlign="center">
          <StackItem size="fill"><Heading level={2}>Needs attention</Heading></StackItem>
          <Text type="supporting" color="secondary">{combinedCount} unique {combinedCount === 1 ? 'transaction' : 'transactions'}</Text>
        </HStack>
        {needsReview.count > 0 ? (
          <Banner
            status="info"
            title={`${needsReview.count} ${needsReview.count === 1 ? 'transaction needs' : 'transactions need'} review`}
            description={
              <VStack gap={1}>
                <Text>{formatMinorCurrencySummary(needsReview.amountMinor, 'INR')} across {period}. Confirm ambiguous merchants, notes, and classifications.</Text>
                <Text type="supporting">Agent prompt: Review my {needsReview.count} uncertain transactions from {period} and explain your classifications.</Text>
              </VStack>
            }
            endContent={<Link href={needsReviewHref} isStandalone>Review transactions</Link>}
          />
        ) : (
          <Banner status="success" title={`All transactions reviewed for ${period}`} />
        )}
        {uncategorized.count > 0 ? (
          <Banner
            status="warning"
            title={`${uncategorized.count} uncategorized ${uncategorized.count === 1 ? 'transaction' : 'transactions'}`}
            description={
              <VStack gap={1}>
                <Text>{formatMinorCurrencySummary(uncategorized.amountMinor, 'INR')} from {period} still needs a category.</Text>
                <Text type="supporting">Agent prompt: Review and categorize my {uncategorized.count} uncategorized transactions from {period}.</Text>
              </VStack>
            }
            endContent={<Link href={uncategorizedHref} isStandalone>Categorize transactions</Link>}
          />
        ) : (
          <Banner status="success" title={`Everything is categorized for ${period}`} />
        )}
      </VStack>
    </Section>
  );
}
