"use client";

import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Item } from "@astryxdesign/core/Item";
import { Section } from "@astryxdesign/core/Section";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useState } from "react";
import { copyPrompt } from "@/lib/agent-prompts";

export function DashboardAgentPrompts({ prompts }: { prompts: string[] }) {
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  return (
    <Section height="100%" padding={4} variant="section">
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>Explore chart with your AI</Heading>
          <Text type="supporting" color="secondary">
            Copy a prompt into your WebMCP-capable agent.
          </Text>
        </VStack>
        <VStack as="ul" gap={1}>
          {prompts.map((prompt) => (
            <Item
              as="li"
              key={prompt}
              label={
                <Text type="supporting" textWrap="pretty" size="base">
                  {prompt}
                </Text>
              }
              endContent={
                <Button
                  label={copiedPrompt === prompt ? "Copied" : "Copy"}
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void copyPrompt(prompt).then(() => setCopiedPrompt(prompt))
                  }
                />
              }
              align="start"
              density="balanced"
            />
          ))}
        </VStack>
      </VStack>
    </Section>
  );
}
