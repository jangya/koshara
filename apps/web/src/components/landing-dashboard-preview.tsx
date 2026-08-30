import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Icon} from '@astryxdesign/core/Icon';
import {Item} from '@astryxdesign/core/Item';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';
import {WalletCards} from 'lucide-react';

const categorySpending = [
  {name: 'Groceries', amount: '₹18,240', value: 31},
  {name: 'Housing', amount: '₹16,500', value: 28},
  {name: 'Transport', amount: '₹9,680', value: 17},
  {name: 'Utilities', amount: '₹6,420', value: 11},
] as const;

const recentTransactions = [
  {description: 'Fresh Market', category: 'Groceries', amount: '−₹2,840'},
  {description: 'Metro Energy', category: 'Utilities', amount: '−₹1,960'},
  {description: 'Salary credit', category: 'Income', amount: '+₹92,000'},
  {description: 'City Fuel', category: 'Transport', amount: '−₹3,240'},
] as const;

export function LandingDashboardPreview() {
  return (
    <Card padding={0} elevation="high" className="landing-preview">
      <VisuallyHidden as="div">
        <Heading level={2}>Household finance dashboard preview</Heading>
      </VisuallyHidden>
      <HStack padding={4} gap={3} vAlign="center" className="landing-preview-header">
        <Icon icon={WalletCards} color="accent" />
        <StackItem size="fill">
          <VStack gap={0}>
            <Text weight="semibold">Mehta household</Text>
            <Text type="supporting" color="secondary">July 2026 overview</Text>
          </VStack>
        </StackItem>
        <Text type="supporting" color="secondary">Saved locally</Text>
      </HStack>

      <VStack padding={5} gap={5}>
        <Grid columns={{minWidth: 160, max: 3, repeat: 'fit'}} gap={3}>
          <Card padding={4} variant="muted" className="landing-metric">
            <VStack gap={2}>
              <Text type="supporting" color="secondary">Spent this month</Text>
              <Heading level={3} type="display-3">₹58,420</Heading>
              <Text type="supporting" color="secondary">↓ 8% from June</Text>
            </VStack>
          </Card>
          <Card padding={4} variant="muted" className="landing-metric">
            <VStack gap={2}>
              <Text type="supporting" color="secondary">Income</Text>
              <Heading level={3} type="display-3">₹92,000</Heading>
              <Text type="supporting" color="secondary">2 credits</Text>
            </VStack>
          </Card>
          <Card padding={4} variant="muted" className="landing-metric">
            <VStack gap={2}>
              <Text type="supporting" color="secondary">Available balance</Text>
              <Heading level={3} type="display-3">₹1,84,230</Heading>
              <Text type="supporting" color="secondary">Across 3 accounts</Text>
            </VStack>
          </Card>
        </Grid>

        <Grid columns={{minWidth: 260, max: 2, repeat: 'fit'}} gap={6}>
          <VStack gap={3}>
            <HStack vAlign="center">
              <StackItem size="fill"><Heading level={3}>Spending by category</Heading></StackItem>
              <Text type="supporting" color="secondary">₹58,420</Text>
            </HStack>
            <VStack as="ul" gap={1}>
              {categorySpending.map((category) => (
                <Item
                  as="li"
                  key={category.name}
                  label={category.name}
                  description={
                    <ProgressBar
                      label={`${category.name} share of monthly spending`}
                      value={category.value}
                      variant="accent"
                      isLabelHidden
                    />
                  }
                  endContent={category.amount}
                  density="balanced"
                />
              ))}
            </VStack>
          </VStack>

          <VStack gap={3}>
            <HStack vAlign="center">
              <StackItem size="fill"><Heading level={3}>Recent transactions</Heading></StackItem>
              <Text type="supporting" color="secondary">View all</Text>
            </HStack>
            <VStack as="ul" gap={0}>
              {recentTransactions.map((transaction) => (
                <Item
                  as="li"
                  key={`${transaction.description}-${transaction.amount}`}
                  label={transaction.description}
                  description={transaction.category}
                  endContent={transaction.amount}
                  density="balanced"
                />
              ))}
            </VStack>
          </VStack>
        </Grid>
      </VStack>
    </Card>
  );
}
