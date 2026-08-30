'use client';

import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {useState} from 'react';

const DEMO_PROMPT = 'Import the attached demo statement into Koshara using the WebMCP tools available in the open Koshara tab. Use the existing account and categories, check the transactions in one batch for duplicates and validation, then add valid transactions in one batch. Skip likely duplicates and mark uncertain classifications as needs_review. Prefer WebMCP tools instead of browser automation.';

export function LandingDemoPrompt() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(DEMO_PROMPT);
    setCopied(true);
  }

  return (
    <VStack gap={3} className="landing-prompt">
      <HStack gap={3} vAlign="center" wrap="wrap">
        <StackItem size="fill">
          <Text type="label">Ready-made agent prompt</Text>
        </StackItem>
        <Button
          label={copied ? 'Copied' : 'Copy prompt'}
          variant="secondary"
          size="sm"
          icon={<Icon icon={copied ? 'check' : 'copy'} color={copied ? 'success' : 'inherit'} />}
          clickAction={copyPrompt}
        />
      </HStack>
      <Text type="code" as="p" className="landing-prompt-text">{DEMO_PROMPT}</Text>
      <Text type="supporting" color="secondary" as="p">
        Attach the sample statement to your WebMCP-capable AI agent and keep the Koshara tab open.
      </Text>
    </VStack>
  );
}
