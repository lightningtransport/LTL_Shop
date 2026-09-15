import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Badge, badgeVariants } from './badge';
import { Button, buttonVariants } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Input } from './input';
import { Label } from './label';
import { Separator } from './separator';
import { Skeleton } from './skeleton';
import { Textarea } from './textarea';

describe('shadcn primitives', () => {
  it('preserves the branded Button contract and safe default type', () => {
    const markup = renderToStaticMarkup(<Button variant="secondary">Continue</Button>);

    expect(markup).toContain('type="button"');
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('bg-card');
    expect(buttonVariants({ size: 'icon' })).toContain('size-11');
  });

  it('supports status variants on the shared Badge', () => {
    const markup = renderToStaticMarkup(<Badge variant="success">Completed</Badge>);

    expect(markup).toContain('text-shop-success');
    expect(badgeVariants({ variant: 'warning' })).toContain('text-shop-accentDark');
  });

  it('keeps the existing Card spacing and semantic title structure', () => {
    const markup = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Truck</CardTitle>
          <CardDescription>Current assignment</CardDescription>
        </CardHeader>
        <CardContent>Details</CardContent>
        <CardFooter>Actions</CardFooter>
      </Card>,
    );

    expect(markup).toContain('<h3');
    expect(markup).toContain('shadow-soft');
    expect(markup).toContain('mb-4');
  });

  it('renders accessible form controls with validation hooks', () => {
    const markup = renderToStaticMarkup(
      <>
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" aria-invalid />
        <Textarea aria-label="Details" />
      </>,
    );

    expect(markup).toContain('for="notes"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-invalid:border-destructive');
    expect(markup).toContain('min-h-28');
  });

  it('renders Separator and Skeleton with official composition APIs', () => {
    const markup = renderToStaticMarkup(
      <>
        <Separator />
        <Skeleton aria-label="Loading" className="h-4" />
      </>,
    );

    expect(markup).toContain('data-orientation="horizontal"');
    expect(markup).toContain('animate-pulse');
    expect(markup).toContain('bg-muted');
  });
});
