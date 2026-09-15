import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Alert, AlertDescription } from './alert';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from './empty';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from './field';
import { Input } from './input';
import { NativeSelect, NativeSelectOption } from './native-select';
import { ScrollArea } from './scroll-area';
import { sheetVariants } from './sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

describe('shadcn form and feedback compositions', () => {
  it('associates fields, descriptions, invalid controls, and errors', () => {
    const markup = renderToStaticMarkup(
      <FieldGroup>
        <Field data-invalid>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" aria-invalid aria-describedby="email-help" />
          <FieldDescription id="email-help">Use your shop account.</FieldDescription>
          <FieldError>Enter a valid email.</FieldError>
        </Field>
      </FieldGroup>,
    );

    expect(markup).toContain('role="group"');
    expect(markup).toContain('for="email"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('role="alert"');
  });

  it('keeps native mobile selection behavior and branded control sizing', () => {
    const markup = renderToStaticMarkup(
      <NativeSelect aria-label="Priority">
        <NativeSelectOption value="normal">Normal</NativeSelectOption>
      </NativeSelect>,
    );

    expect(markup).toContain('<select');
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('data-slot="native-select-icon"');
  });

  it('provides shared alert and empty-state composition slots', () => {
    const markup = renderToStaticMarkup(
      <>
        <Alert variant="destructive"><AlertDescription>Unable to save.</AlertDescription></Alert>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No jobs</EmptyTitle>
            <EmptyDescription>Add a job to continue.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>,
    );

    expect(markup).toContain('data-slot="alert-description"');
    expect(markup).toContain('data-slot="empty-title"');
  });

  it('supports directional Sheet variants without manual overlay styles', () => {
    expect(sheetVariants({ side: 'bottom' })).toContain('slide-in-from-bottom-4');
    expect(sheetVariants({ side: 'right' })).toContain('slide-in-from-right-4');
  });

  it('provides semantic, scroll-safe data compositions', () => {
    const markup = renderToStaticMarkup(
      <ScrollArea className="h-48">
        <Table>
          <TableHeader><TableRow><TableHead>Truck</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell>104</TableCell></TableRow></TableBody>
        </Table>
      </ScrollArea>,
    );

    expect(markup).toContain('<table');
    expect(markup).toContain('<th');
    expect(markup).toContain('<td');
    expect(markup).toContain('data-radix-scroll-area-viewport');
  });
});
