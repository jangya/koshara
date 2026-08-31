'use client';

import {Button} from '@astryxdesign/core/Button';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';
import {useState} from 'react';

import {copyPrompt} from '@/lib/agent-prompts';

export function TryWithAiAgent({prompts, headingLevel = 2}: {prompts: string[]; headingLevel?: 2 | 3}) {
  const [feedback, setFeedback] = useState<{index: number; message: string} | null>(null);

  async function copy(prompt: string, index: number) {
    try {
      await copyPrompt(prompt);
      setFeedback({index, message: 'Prompt copied to clipboard.'});
    } catch {
      setFeedback({index, message: 'Could not copy the prompt. Select the visible text and copy it manually.'});
    }
  }

  return (
    <Section variant="muted">
      <VStack gap={3}>
        <VStack gap={1}>
          <Heading level={headingLevel}>Try with your AI agent</Heading>
          <Text type="supporting" color="secondary">
            Koshara exposes finance tools to your external AI agent. Copy a prompt below and send it there—nothing runs inside Koshara.
          </Text>
        </VStack>
        <VStack as="ul" gap={0}>
          {prompts.map((prompt, index) => (
            <Item
              as="li"
              key={prompt}
              label={<Text textWrap="pretty">{prompt}</Text>}
              endContent={
                <Button
                  label={feedback?.index === index && feedback.message.startsWith('Prompt copied') ? 'Copied' : 'Copy prompt'}
                  variant="secondary"
                  size="sm"
                  onClick={() => void copy(prompt, index)}
                />
              }
              align="start"
              density="balanced"
            />
          ))}
        </VStack>
        <VisuallyHidden as="div"><Text as="div" aria-live="polite">{feedback?.message ?? ''}</Text></VisuallyHidden>
        {feedback && !feedback.message.startsWith('Prompt copied') ? <Text type="supporting">{feedback.message}</Text> : null}
      </VStack>
    </Section>
  );
}
