import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Section} from '@astryxdesign/core/Section';

export function FeatureEmptyState({title, description}: {title: string; description: string}) {
  return (
    <Section variant="transparent" minHeight="24rem">
      <EmptyState title={title} description={description} headingLevel={2} />
    </Section>
  );
}
