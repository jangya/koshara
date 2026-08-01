import {Heading} from '@astryxdesign/core/Heading';
import {Layout, LayoutContent, LayoutHeader} from '@astryxdesign/core/Layout';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import type {ReactNode} from 'react';

export function Page({title, description, actions, children}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Layout>
      <LayoutHeader hasDivider label={`${title} page header`}>
        <HStack gap={4} padding={5} vAlign="center" wrap="wrap">
          <StackItem size="fill">
            <VStack gap={1}>
              <Heading level={1}>{title}</Heading>
              {description ? <Text color="secondary">{description}</Text> : null}
            </VStack>
          </StackItem>
          {actions}
        </HStack>
      </LayoutHeader>
      <LayoutContent padding={5}>{children}</LayoutContent>
    </Layout>
  );
}
