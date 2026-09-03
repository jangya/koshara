'use client';

import {Button} from '@astryxdesign/core/Button';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Icon} from '@astryxdesign/core/Icon';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {STATEMENT_IMPORT_PROMPT} from '@/lib/agent-prompts';
import {useState} from 'react';

export function LandingDemoPrompt() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(STATEMENT_IMPORT_PROMPT);
    setCopied(true);
  }

  return (
    <VStack gap={3} className="landing-prompt">
      <HStack gap={3} vAlign="center" wrap="wrap">
        <StackItem size="fill">
          <VStack gap={1}>
            <Text type="label">Ready-made agent prompt</Text>
            <Text type="supporting" color="secondary" as="p">
              Use this with your WebMCP-capable AI.
            </Text>
          </VStack>
        </StackItem>
        <Button
          label={copied ? 'Copied' : 'Copy prompt'}
          variant="primary"
          size="sm"
          icon={<Icon icon={copied ? 'check' : 'copy'} color={copied ? 'success' : 'inherit'} />}
          clickAction={copyPrompt}
        />
      </HStack>
      <Collapsible trigger="View prompt" defaultIsOpen={false}>
        <Text type="code" as="p" className="landing-prompt-text">
          {STATEMENT_IMPORT_PROMPT}
        </Text>
      </Collapsible>
    </VStack>
  );
}
