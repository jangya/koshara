"use client";

import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import {
  Bot,
  Download,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
  WalletCards,
  Wrench,
} from "lucide-react";

import { LandingDashboardPreview } from "@/components/landing-dashboard-preview";
import { LandingDemoPrompt } from "@/components/landing-demo-prompt";
import { LandingWebMcpExperiences } from "@/components/landing-webmcp-experiences";

const workflowSteps = [
  {
    number: "01",
    title: "Use Koshara normally",
    description:
      "Explore your dashboard, transactions, accounts and categories through the regular interface.",
    icon: LayoutDashboard,
  },
  {
    number: "02",
    title: "Ask your AI",
    description:
      "Use your preferred AI when you want insights or when a task becomes tedious.",
    icon: Bot,
  },
  {
    number: "03",
    title: "Koshara provides structure",
    description:
      "WebMCP gives your AI access to the same financial data, rules and actions available in Koshara.",
    icon: Wrench,
  },
  {
    number: "04",
    title: "Review in the same UI",
    description:
      "See the result in Koshara, continue manually, or approve changes when required.",
    icon: ShieldCheck,
  },
] as const;

function LandingNavigation() {
  return (
    <TopNav
      label="Koshara navigation"
      heading={
        <TopNavHeading
          heading="Koshara"
          headingHref="/"
          logo={<Icon icon={WalletCards} color="accent" />}
        />
      }
      endContent={
        <HStack gap={1} vAlign="center">
          <TopNavItem label="Dashboard" href="/dashboard" />
          <TopNavItem label="Try demo" href="#demo" />
        </HStack>
      }
    />
  );
}

export default function HomePage() {
  return (
    <AppShell
      topNav={<LandingNavigation />}
      contentPadding={0}
      height="auto"
      variant="section"
      mobileNav={false}
      className="landing-shell"
    >
      <VStack gap={0} className="landing-page">
        <Section variant="transparent" padding={0} className="landing-hero">
          <VStack
            gap={8}
            hAlign="center"
            className="landing-container landing-hero-inner"
          >
            <VStack gap={5} hAlign="center" className="landing-hero-copy">
              <Text type="label" color="accent" className="landing-eyebrow">
                Finance that works with your AI
              </Text>
              <Heading
                level={1}
                type="display-1"
                justify="center"
                textWrap="balance"
              >
                Your household finances, ready for you and your AI.
              </Heading>
              <Text
                type="large"
                color="secondary"
                justify="center"
                textWrap="pretty"
                as="p"
              >
                Track spending visually, ask your preferred AI for insights, and
                hand off tedious tasks like statement imports — all using the
                same Koshara data.
              </Text>
              <HStack
                gap={3}
                hAlign="center"
                wrap="wrap"
                className="landing-hero-actions"
              >
                <Link
                  href="#demo"
                  isStandalone
                  className="landing-cta landing-cta-primary"
                >
                  Try the demo
                </Link>
                <Link
                  href="/dashboard"
                  isStandalone
                  className="landing-cta landing-cta-secondary"
                >
                  Explore dashboard
                </Link>
              </HStack>
              <Text type="supporting" color="secondary">
                Your finances, organized by you — or your AI.
              </Text>
            </VStack>
            <LandingDashboardPreview />
          </VStack>
        </Section>

        <Section variant="section" padding={8} className="landing-section">
          <VStack gap={8} className="landing-container">
            <VStack gap={3} className="landing-section-heading">
              <Text type="label" color="accent">
                How it works
              </Text>
              <Heading level={2} type="display-3" textWrap="balance">
                A simple handoff between you, your AI, and Koshara.
              </Heading>
              <Text color="secondary" as="p">
                You bring the AI. Koshara gives it safe, structured ways to work
                with your finance data.
              </Text>
            </VStack>
            <Grid columns={{ minWidth: 220, max: 4, repeat: "fit" }} gap={4}>
              {workflowSteps.map((step) => (
                <Card
                  key={step.number}
                  padding={5}
                  variant="transparent"
                  className="landing-workflow-step"
                >
                  <VStack gap={4}>
                    <HStack hAlign="between" vAlign="center">
                      <Icon icon={step.icon} color="accent" />
                      <Text
                        type="supporting"
                        color="secondary"
                        hasTabularNumbers
                      >
                        {step.number}
                      </Text>
                    </HStack>
                    <VStack gap={2}>
                      <Heading level={3}>{step.title}</Heading>
                      <Text color="secondary" as="p">
                        {step.description}
                      </Text>
                    </VStack>
                  </VStack>
                </Card>
              ))}
            </Grid>
          </VStack>
        </Section>

        <LandingWebMcpExperiences />

        <Section
          id="demo"
          variant="muted"
          padding={8}
          className="landing-section landing-demo-section"
        >
          <VStack gap={8} className="landing-container">
            <VStack gap={3} className="landing-section-heading">
              <Text type="label" color="accent">
                Interactive demo
              </Text>
              <Heading level={2} type="display-3">
                Try the statement workflow
              </Heading>
              <Text color="secondary" as="p">
                <b>Data stores in local storage.</b> Use the sample statement to
                experience one complete WebMCP workflow from AI analysis to
                Koshara review.
              </Text>
            </VStack>

            <Grid columns={{ minWidth: 260, max: 3, repeat: "fit" }} gap={4}>
              <Card padding={5} className="landing-demo-step">
                <VStack gap={4}>
                  <Text type="label" color="accent">
                    Step 1
                  </Text>
                  <Icon icon={Download} color="accent" size="lg" />
                  <VStack gap={2}>
                    <Heading level={3}>Get the sample statement</Heading>
                    <Text color="secondary" as="p">
                      A synthetic June 2026 credit card statement made for this
                      demo.
                    </Text>
                  </VStack>
                  <Link
                    href="/koshara_demo_credit_card_statement_june_2026.pdf"
                    download
                    isStandalone
                    className="landing-cta landing-cta-secondary landing-cta-full"
                  >
                    Download sample statement
                  </Link>
                </VStack>
              </Card>

              <Card padding={5} className="landing-demo-step">
                <VStack gap={4}>
                  <Text type="label" color="accent">
                    Step 2
                  </Text>
                  <Icon icon={LayoutDashboard} color="accent" size="lg" />
                  <VStack gap={2}>
                    <Heading level={3}>Open Koshara</Heading>
                    <Text color="secondary" as="p">
                      Keep the dashboard open so your agent can use the
                      available WebMCP tools.
                    </Text>
                  </VStack>
                  <Link
                    href="/dashboard"
                    isStandalone
                    className="landing-cta landing-cta-primary landing-cta-full"
                  >
                    Open demo dashboard
                  </Link>
                </VStack>
              </Card>

              <Card padding={5} className="landing-demo-step">
                <VStack gap={4}>
                  <Text type="label" color="accent">
                    Step 3
                  </Text>
                  <Icon icon={Bot} color="accent" size="lg" />
                  <VStack gap={2}>
                    <Heading level={3}>Give it to your AI</Heading>
                    <Text color="secondary" as="p">
                      Attach the PDF to your preferred WebMCP-capable agent,
                      then paste the prompt below.
                    </Text>
                  </VStack>
                </VStack>
              </Card>
            </Grid>

            <LandingDemoPrompt />

            <Grid columns={{ minWidth: 280, max: 2, repeat: "fit" }} gap={4}>
              <Banner
                status="warning"
                title="Using your own statement?"
                description="Financial documents may contain sensitive information. Redact or anonymize personal identifiers before sharing them with any external AI service."
              />
              <Banner
                status="info"
                icon={<Icon icon={ShieldCheck} color="accent" />}
                title="Koshara stores demo data locally"
                description="Koshara's demo data is stored in this browser, not uploaded by Koshara to a cloud database. External AI services have their own data practices."
              />
            </Grid>
          </VStack>
        </Section>

        <Section variant="section" padding={8} className="landing-section">
          <VStack gap={8} className="landing-container">
            <VStack gap={3} className="landing-section-heading">
              <Text type="label" color="accent">
                Use Koshara your way
              </Text>
              <Heading level={2} type="display-3">
                A dashboard for you. Structured capabilities for your AI.
              </Heading>
            </VStack>
            <Grid columns={{ minWidth: 280, max: 2, repeat: "fit" }} gap={6}>
              <VStack gap={3}>
                <Icon icon={UserRound} color="accent" size="lg" />
                <Heading level={3}>For you</Heading>
                <Text color="secondary" as="p">
                  Manage transactions, accounts, categories and spending
                  visually through the dashboard.
                </Text>
              </VStack>
              <VStack gap={3}>
                <Icon icon={Bot} color="accent" size="lg" />
                <Heading level={3}>For your AI</Heading>
                <Text color="secondary" as="p">
                  When a task becomes tedious or you want deeper insight, your
                  preferred agent can work with the same Koshara data through
                  WebMCP.
                </Text>
              </VStack>
            </Grid>
          </VStack>
        </Section>

        <Section
          variant="transparent"
          padding={0}
          dividers={["top"]}
          className="landing-footer"
        >
          <HStack
            gap={4}
            hAlign="between"
            vAlign="center"
            wrap="wrap"
            className="landing-container landing-footer-inner"
          >
            <VStack gap={1}>
              <Text weight="semibold">Koshara</Text>
              <Text type="supporting" color="secondary">
                Your finances. Your interface. Your AI.
              </Text>
            </VStack>
            <Text type="supporting" color="secondary">
              Built for the WebMCP hackathon.
            </Text>
          </HStack>
        </Section>
      </VStack>
    </AppShell>
  );
}
