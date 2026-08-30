'use client';

import {Button} from '@astryxdesign/core/Button';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Popover} from '@astryxdesign/core/Popover';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {useEffect, useState} from 'react';

import {KOSHARA_WEBMCP_TOOL_GROUPS, KOSHARA_WEBMCP_TOOLS, type WebMCPTool} from '@/lib/webmcp-tool-registry';

type ModelContext = {
  registerTool: (tool: WebMCPTool, options?: {signal?: AbortSignal}) => Promise<void>;
};

function ToolGroup({label, names}: {label: string; names: readonly string[]}) {
  return (
    <VStack gap={1}>
      <Heading level={3}>{label}</Heading>
      <VStack as="ul" gap={0}>
        {names.map((name) => <Item as="li" key={name} label={<Text type="code">{name}</Text>} density="compact" />)}
      </VStack>
    </VStack>
  );
}

export function WebMCPTools() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistrationComplete, setIsRegistrationComplete] = useState(false);
  const [registeredCount, setRegisteredCount] = useState(0);

  useEffect(() => {
    const modelContext = (document as Document & {modelContext?: ModelContext}).modelContext;
    if (!modelContext) return;

    const controller = new AbortController();
    let isActive = true;
    queueMicrotask(() => {
      if (isActive) setIsSupported(true);
    });
    void Promise.allSettled(KOSHARA_WEBMCP_TOOLS.map((tool) => modelContext.registerTool(tool, {signal: controller.signal})))
      .then((results) => {
        if (!isActive) return;
        setRegisteredCount(results.filter((result) => result.status === 'fulfilled').length);
        setIsRegistrationComplete(true);
      });
    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const total = KOSHARA_WEBMCP_TOOLS.length;
  const availableCount = isSupported && isRegistrationComplete ? registeredCount : total;
  const status = isSupported
    ? isRegistrationComplete ? `${registeredCount} of ${total} registered with this browser.` : 'Registering tools with this browser…'
    : 'Connect your AI agent to this browser tab to work with Koshara.';

  return (
    <HStack
      as="aside"
      style={{position: 'fixed', insetInlineEnd: 'var(--spacing-3)', bottom: 'var(--spacing-3)'}}
    >
      <Popover
        placement="above"
        alignment="end"
        label="Koshara WebMCP tools"
        hasCloseButton={false}
        width={360}
        content={
          <VStack gap={4} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>Koshara WebMCP Tools</Heading>
              <Text type="supporting" color="secondary">{status}</Text>
            </VStack>
            {KOSHARA_WEBMCP_TOOL_GROUPS.map((group) => <ToolGroup key={group.label} label={group.label} names={group.names} />)}
          </VStack>
        }
      >
        <Button label={`${availableCount} WebMCP tools available`} variant="secondary" size="sm" elevation="low">
          <HStack gap={2} vAlign="center">
            <StatusDot variant={isSupported ? 'accent' : 'neutral'} label={isSupported ? 'WebMCP supported' : 'WebMCP ready'} />
            <Text type="supporting">{availableCount} WebMCP tools available</Text>
          </HStack>
        </Button>
      </Popover>
    </HStack>
  );
}
