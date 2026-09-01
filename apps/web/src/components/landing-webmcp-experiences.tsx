import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Icon} from '@astryxdesign/core/Icon';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Section} from '@astryxdesign/core/Section';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Banknote, LayoutDashboard} from 'lucide-react';

export function LandingWebMcpExperiences() {
  return (
    <Section variant="section" padding={8} className="landing-section">
      <VStack gap={8} className="landing-container">
        <VStack gap={3} className="landing-section-heading">
          <Text type="label" color="accent">
            Flagship WebMCP experiences
          </Text>
          <Heading level={2} type="display-3" textWrap="balance">
            See how your AI can work with Koshara
          </Heading>
          <Text color="secondary" as="p">
            From exploring your finances to handling tedious workflows, your AI
            can use Koshara&apos;s structured capabilities while you stay in
            control.
          </Text>
        </VStack>

        <Grid columns={{minWidth: 280, max: 2, repeat: 'fit'}} gap={4}>
          <Card padding={6} height="100%">
            <VStack gap={5}>
              <Icon icon={LayoutDashboard} color="accent" size="lg" />
              <VStack gap={2}>
                <Heading level={3}>Understand your finances</Heading>
                <Text color="secondary" as="p">
                  Ask questions about your spending and let your AI use
                  Koshara&apos;s structured financial data to update the dashboard
                  view.
                </Text>
              </VStack>
              <VStack gap={3}>
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">
                    Example prompt
                  </Text>
                  <Text weight="semibold" as="p">
                    “Show me dining and grocery spending for the last three
                    months.”
                  </Text>
                </VStack>
                <VStack gap={3}>
                  <VStack gap={1}>
                    <HStack hAlign="between" vAlign="center">
                      <Text type="supporting">Dining</Text>
                      <Text type="supporting" hasTabularNumbers>
                        ₹12,480
                      </Text>
                    </HStack>
                    <ProgressBar
                      label="Dining spending"
                      value={72}
                      variant="accent"
                      isLabelHidden
                    />
                  </VStack>
                  <VStack gap={1}>
                    <HStack hAlign="between" vAlign="center">
                      <Text type="supporting">Groceries</Text>
                      <Text type="supporting" hasTabularNumbers>
                        ₹9,260
                      </Text>
                    </HStack>
                    <ProgressBar
                      label="Grocery spending"
                      value={54}
                      variant="neutral"
                      isLabelHidden
                    />
                  </VStack>
                </VStack>
              </VStack>
              <Text type="supporting" color="secondary" as="p">
                The dashboard filters and charts update so you can continue
                exploring visually.
              </Text>
            </VStack>
          </Card>

          <Card padding={6} height="100%">
            <VStack gap={5}>
              <Icon icon={Banknote} color="accent" size="lg" />
              <VStack gap={2}>
                <Heading level={3}>Import a statement</Heading>
                <Text color="secondary" as="p">
                  Give a bank or credit-card statement to your preferred AI.
                  Koshara helps it match accounts and categories, detect
                  duplicates and prepare transactions for review.
                </Text>
              </VStack>
              <VStack gap={1}>
                <Text type="supporting" color="secondary">
                  Workflow
                </Text>
                <Text type="label" color="accent" as="p">
                  Statement → AI → Review → Dashboard
                </Text>
              </VStack>
              <Text type="supporting" color="secondary" as="p">
                Nothing is committed until the user reviews and approves the
                proposed changes.
              </Text>
            </VStack>
          </Card>
        </Grid>
      </VStack>
    </Section>
  );
}
