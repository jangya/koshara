'use client';

import {Button} from '@astryxdesign/core/Button';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Popover} from '@astryxdesign/core/Popover';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {usePathname} from 'next/navigation';
import {useEffect, useMemo, useState} from 'react';

import {copyPrompt, getPageAgentPrompts} from '@/lib/agent-prompts';
import {getWebMCPPageContext, type WebMCPTool} from '@/lib/webmcp-tool-registry';

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
  const pathname = usePathname();
  const pageContext = useMemo(() => getWebMCPPageContext(pathname), [pathname]);
  const prompts = useMemo(() => getPageAgentPrompts(pathname), [pathname]);
  const [registration, setRegistration] = useState({pathname: '', isSupported: false, isComplete: false, count: 0});
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (!pageContext) return;
    const modelContext = (document as Document & {modelContext?: ModelContext}).modelContext;
    if (!modelContext) return;

    const controller = new AbortController();
    let isActive = true;
    queueMicrotask(() => {
      if (isActive) setRegistration({pathname, isSupported: true, isComplete: false, count: 0});
    });
    void Promise.allSettled(pageContext.tools.map((tool) => modelContext.registerTool(tool, {signal: controller.signal})))
      .then((results) => {
        if (!isActive) return;
        setRegistration({
          pathname,
          isSupported: true,
          isComplete: true,
          count: results.filter((result) => result.status === 'fulfilled').length,
        });
      });
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [pageContext, pathname]);

  if (!pageContext) return null;

  const total = pageContext.tools.length;
  const currentRegistration = registration.pathname === pathname
    ? registration
    : {pathname, isSupported: false, isComplete: false, count: 0};
  const {isSupported, isComplete: isRegistrationComplete, count: registeredCount} = currentRegistration;
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
              <Heading level={2}>{pageContext.label} agent tools</Heading>
              <Text type="supporting" color="secondary">{status}</Text>
            </VStack>
            {prompts.length > 0 ? (
              <Collapsible trigger={`Example agent prompts (${prompts.length})`} defaultIsOpen={false}>
                <VStack as="ul" gap={0}>
                  {prompts.map((prompt) => (
                    <Item
                      as="li"
                      key={prompt}
                      label={<Text type="supporting" textWrap="pretty">{prompt}</Text>}
                      endContent={
                        <Button
                          label={copiedPrompt === prompt ? 'Copied' : 'Copy'}
                          variant="ghost"
                          size="sm"
                          onClick={() => void copyPrompt(prompt).then(() => setCopiedPrompt(prompt))}
                        />
                      }
                      align="start"
                      density="compact"
                    />
                  ))}
                </VStack>
              </Collapsible>
            ) : null}
            {pageContext.groups.map((group) => <ToolGroup key={group.label} label={group.label} names={group.names} />)}
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
