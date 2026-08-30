import {Banner} from '@astryxdesign/core/Banner';
import {Divider} from '@astryxdesign/core/Divider';
import {Heading} from '@astryxdesign/core/Heading';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Token} from '@astryxdesign/core/Token';
import {getGmailConnection, listFinancialAccounts, listGmailAttachments} from '@koshara/database';
import type {Metadata} from 'next';

import {GmailAttachmentTable} from '@/components/gmail-attachment-table';
import {GmailConnectionActions} from '@/components/gmail-connection-actions';
import {Page} from '@/components/page';
import {getDatabase} from '@/lib/database';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Gmail'};

const notices = {
  connected: {status: 'success', title: 'Gmail connected with read-only access'},
  'connection-cancelled': {status: 'info', title: 'Gmail connection was cancelled'},
  'account-mismatch': {status: 'error', title: 'Connect the same verified Google address used for this Koshara account'},
  'connection-failed': {status: 'error', title: 'The Gmail connection could not be completed'},
  'already-connected': {status: 'info', title: 'Gmail is already connected'},
} as const;

export default async function GmailPage({searchParams}: {searchParams: Promise<{notice?: string}>}) {
  const context = await getHouseholdPageContext();
  const [connection, attachments, accounts] = await Promise.all([
    getGmailConnection(getDatabase(), context.householdId, context.clerkUserId),
    listGmailAttachments(getDatabase(), context.householdId, context.clerkUserId),
    listFinancialAccounts(getDatabase(), context.householdId),
  ]);
  const isConnectionActive = Boolean(connection && !connection.disconnectedAt);
  const noticeKey = (await searchParams).notice;
  const notice = noticeKey && noticeKey in notices ? notices[noticeKey as keyof typeof notices] : undefined;

  return (
    <Page
      title="Gmail"
      description="Discover PDF statements on demand, then import one attachment through the existing private review workflow."
    >
      <VStack gap={6}>
        {notice ? <Banner status={notice.status} title={notice.title} /> : null}
        <Section>
          <VStack gap={4}>
            <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
              <VStack gap={1}>
                <Heading level={2}>Read-only Gmail connection</Heading>
                <Text color="secondary">
                  Koshara requests only Gmail read access. It does not send, modify, label, or delete mail.
                </Text>
              </VStack>
              <Token
                label={isConnectionActive ? 'Connected' : 'Not connected'}
                color={isConnectionActive ? 'green' : 'gray'}
              />
            </HStack>
            {isConnectionActive && connection ? (
              <VStack gap={3}>
                <Text>Connected as {connection.emailAddress}</Text>
                <GmailConnectionActions connectionId={connection.id} />
              </VStack>
            ) : (
              <VStack gap={3}>
                <Text color="secondary">
                  Connection must use the same verified Google address as your signed-in Koshara identity. Access tokens and refresh tokens are encrypted before database storage.
                </Text>
                <Link href="/gmail/oauth/connect" isStandalone>Connect Gmail read-only</Link>
              </VStack>
            )}
          </VStack>
        </Section>
        <Divider />
        <Section padding={0}>
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Discovered PDF statements</Heading>
              <Text color="secondary">
                Discovery checks at most 25 matching messages per explicit request. Message bodies are not stored, and attachment bytes are fetched only when you choose Import PDF.
              </Text>
            </VStack>
            {attachments.length > 0 ? (
              <GmailAttachmentTable
                attachments={attachments.map((attachment) => ({
                  id: attachment.id,
                  filename: attachment.originalFilename,
                  received: attachment.messageReceivedAt.toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}),
                  size: `${(attachment.byteSize / (1024 * 1024)).toFixed(2)} MB`,
                  status: attachment.status,
                  importSessionId: attachment.importSessionId,
                }))}
                accounts={accounts.map(({id, displayName}) => ({id, displayName}))}
                isConnectionActive={isConnectionActive}
              />
            ) : (
              <Text color="secondary">
                {isConnectionActive
                  ? 'No PDF statements have been discovered. Run discovery when you are ready.'
                  : 'Connect Gmail before running manual statement discovery.'}
              </Text>
            )}
          </VStack>
        </Section>
      </VStack>
    </Page>
  );
}
