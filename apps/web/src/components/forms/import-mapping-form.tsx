'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {Selector} from '@astryxdesign/core/Selector';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import type {CsvColumnMapping} from '@koshara/domain';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

import {mapCsvImportSessionAction, type ImportActionResult} from '@/app/(app)/import-actions';

type ImportFileForMapping = {id: string; originalFilename: string; headers: string[]; rowCount: number};
type FileMappingState = {
  dateColumn: string;
  descriptionColumn: string;
  dateFormat: CsvColumnMapping['dateFormat'];
  hasSeparateDebitCredit: boolean;
  amountColumn: string;
  debitColumn: string;
  creditColumn: string;
};

const emptyMapping: FileMappingState = {
  dateColumn: '',
  descriptionColumn: '',
  dateFormat: 'dd/MM/yyyy',
  hasSeparateDebitCredit: false,
  amountColumn: '',
  debitColumn: '',
  creditColumn: '',
};

export function ImportMappingForm({importSessionId, files}: {
  importSessionId: string;
  files: ImportFileForMapping[];
}) {
  const router = useRouter();
  const [mappings, setMappings] = useState<Record<string, FileMappingState>>(
    Object.fromEntries(files.map((file) => [file.id, {...emptyMapping}])),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImportActionResult | null>(null);

  function updateMapping(fileId: string, patch: Partial<FileMappingState>) {
    setMappings((current) => ({...current, [fileId]: {...current[fileId]!, ...patch}}));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mappedFiles = files.map((file) => {
      const mapping = mappings[file.id]!;
      return {
        fileId: file.id,
        mapping: {
          dateColumn: mapping.dateColumn,
          descriptionColumn: mapping.descriptionColumn,
          dateFormat: mapping.dateFormat,
          amount: mapping.hasSeparateDebitCredit
            ? {mode: 'debit-credit' as const, debitColumn: mapping.debitColumn, creditColumn: mapping.creditColumn}
            : {mode: 'signed' as const, amountColumn: mapping.amountColumn},
        },
      };
    });
    setIsSubmitting(true);
    setResult(null);
    const nextResult = await mapCsvImportSessionAction({importSessionId, mappings: mappedFiles});
    setResult(nextResult);
    setIsSubmitting(false);
    if (nextResult.status === 'success') router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <VStack gap={5}>
        {result ? <Banner status={result.status} title={result.message} /> : null}
        <Banner
          status="info"
          title="Choose the date order explicitly"
          description="Koshara never guesses whether 01/02 means 1 February or 2 January."
        />
        {files.map((file) => {
          const mapping = mappings[file.id]!;
          const options = file.headers.map((header) => ({value: header, label: header}));
          return (
            <Section key={file.id} variant="muted">
              <VStack gap={4}>
                <VStack gap={1}>
                  <Heading level={3}>{file.originalFilename}</Heading>
                  <Text color="secondary">{file.rowCount.toLocaleString('en-IN')} data rows</Text>
                </VStack>
                <FormLayout>
                  <FormLayout direction="horizontal">
                    <Selector
                      label="Transaction date column"
                      value={mapping.dateColumn}
                      onChange={(value) => updateMapping(file.id, {dateColumn: value})}
                      options={options}
                      placeholder="Choose a column"
                      isRequired
                      width="100%"
                    />
                    <Selector
                      label="Date format"
                      value={mapping.dateFormat}
                      onChange={(value) => updateMapping(file.id, {dateFormat: value as CsvColumnMapping['dateFormat']})}
                      options={[
                        {value: 'dd/MM/yyyy', label: 'DD/MM/YYYY'},
                        {value: 'MM/dd/yyyy', label: 'MM/DD/YYYY'},
                        {value: 'yyyy-MM-dd', label: 'YYYY-MM-DD'},
                      ]}
                      isRequired
                      width="100%"
                    />
                  </FormLayout>
                  <Selector
                    label="Description column"
                    value={mapping.descriptionColumn}
                    onChange={(value) => updateMapping(file.id, {descriptionColumn: value})}
                    options={options}
                    placeholder="Choose a column"
                    isRequired
                    width="100%"
                  />
                  <CheckboxInput
                    label="Debit and credit use separate columns"
                    value={mapping.hasSeparateDebitCredit}
                    onChange={(value) => updateMapping(file.id, {hasSeparateDebitCredit: value})}
                  />
                  {mapping.hasSeparateDebitCredit ? (
                    <FormLayout direction="horizontal">
                      <Selector
                        label="Debit column"
                        value={mapping.debitColumn}
                        onChange={(value) => updateMapping(file.id, {debitColumn: value})}
                        options={options}
                        placeholder="Choose a column"
                        isRequired
                        width="100%"
                      />
                      <Selector
                        label="Credit column"
                        value={mapping.creditColumn}
                        onChange={(value) => updateMapping(file.id, {creditColumn: value})}
                        options={options}
                        placeholder="Choose a column"
                        isRequired
                        width="100%"
                      />
                    </FormLayout>
                  ) : (
                    <Selector
                      label="Signed amount column"
                      description="Debits must be negative; credits must be positive."
                      value={mapping.amountColumn}
                      onChange={(value) => updateMapping(file.id, {amountColumn: value})}
                      options={options}
                      placeholder="Choose a column"
                      isRequired
                      width="100%"
                    />
                  )}
                </FormLayout>
              </VStack>
            </Section>
          );
        })}
        <Button label="Stage candidates for review" type="submit" variant="primary" isLoading={isSubmitting} />
      </VStack>
    </form>
  );
}
