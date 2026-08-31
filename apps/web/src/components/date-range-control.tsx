'use client';

import {DateRangeInput, type DateRange} from '@astryxdesign/core/DateRangeInput';
import {Heading} from '@astryxdesign/core/Heading';
import {Selector} from '@astryxdesign/core/Selector';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {useCallback, useEffect, useMemo, useSyncExternalStore} from 'react';

import {
  DATE_RANGE_PRESETS,
  formatDateRange,
  getDateRangePreset,
  parseDateRangeParams,
  type DateRangePreset,
} from '@/lib/date-range';

const calendarPresets = DATE_RANGE_PRESETS.slice(0, 5).map(({label, value}) => ({
  label,
  getRange: () => getDateRangePreset(value as Exclude<DateRangePreset, 'custom'>),
}));

function useHasHydrated() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

export function useDateRangeSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serializedParams = searchParams.toString();
  const state = useMemo(() => parseDateRangeParams(new URLSearchParams(serializedParams)), [serializedParams]);

  const replaceParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(serializedParams);
    mutate(next);
    router.replace(`${pathname}?${next.toString()}`, {scroll: false});
  }, [pathname, router, serializedParams]);

  const setRange = useCallback((range: DateRange, preset: DateRangePreset = 'custom') => {
    replaceParams((params) => {
      params.set('from', range.start);
      params.set('to', range.end);
      params.set('range', preset);
      params.delete('page');
    });
  }, [replaceParams]);

  useEffect(() => {
    if (searchParams.has('from') && searchParams.has('to')) return;
    setRange(state.range, state.preset);
  }, [searchParams, setRange, state.preset, state.range]);

  return {...state, setRange, replaceParams};
}

export function DateRangeControl({
  range,
  preset,
  onChange,
}: {
  range: DateRange;
  preset: DateRangePreset;
  onChange: (range: DateRange, preset?: DateRangePreset) => void;
}) {
  const periodLabel = formatDateRange(range);
  const hasHydrated = useHasHydrated();

  return (
    <VStack gap={3}>
      <HStack gap={3} vAlign="end" wrap="wrap">
        <StackItem size="fill">
          <VStack gap={0}>
            <Text type="supporting" color="secondary">Active period</Text>
            <Heading level={2}>{periodLabel}</Heading>
          </VStack>
        </StackItem>
        <Selector
          label="Date range preset"
          value={preset}
          onChange={(value) => {
            const nextPreset = value as DateRangePreset;
            if (nextPreset === 'custom') onChange(range, 'custom');
            else onChange(getDateRangePreset(nextPreset), nextPreset);
          }}
          options={[...DATE_RANGE_PRESETS]}
          isLabelHidden
        />
        {hasHydrated ? (
          <DateRangeInput
            label="Exact date range"
            value={range}
            onChange={(value) => value && onChange(value, 'custom')}
            presets={calendarPresets}
            hasClear={false}
            isLabelHidden
          />
        ) : <Skeleton height="var(--spacing-10)" width="calc(var(--spacing-12) * 4)" />}
      </HStack>
      <Text type="supporting" color="secondary">All figures and comparisons on this page use {periodLabel}.</Text>
    </VStack>
  );
}
