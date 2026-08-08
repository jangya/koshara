import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

export function PaginationControls({basePath, page, pageSize, totalItems}: {
  basePath: string;
  page: number;
  pageSize: number;
  totalItems: number;
}) {
  if (totalItems <= pageSize) return null;
  const totalPages = Math.ceil(totalItems / pageSize);
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <Section variant="muted" padding={3}>
      <HStack gap={4} vAlign="center" wrap="wrap">
        <StackItem size="fill">
          <Text color="secondary">{firstItem.toLocaleString('en-IN')}–{lastItem.toLocaleString('en-IN')} of {totalItems.toLocaleString('en-IN')}</Text>
        </StackItem>
        {page > 1 ? <Link href={`${basePath}?page=${page - 1}`} isStandalone>Previous</Link> : <Text color="secondary">Previous</Text>}
        <Text>Page {page} of {totalPages}</Text>
        {page < totalPages ? <Link href={`${basePath}?page=${page + 1}`} isStandalone>Next</Link> : <Text color="secondary">Next</Text>}
      </HStack>
    </Section>
  );
}
