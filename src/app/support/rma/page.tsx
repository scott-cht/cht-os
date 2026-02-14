'use client';

import { useState, type FormEvent } from 'react';

interface FormState {
  orderNumber: string;
  orderEmail: string;
  serialNumber: string;
  issueSummary: string;
  issueDetails: string;
  conditionReport: string;
  honeypot: string;
}

const INITIAL_STATE: FormState = {
  orderNumber: '',
  orderEmail: '',
  serialNumber: '',
  issueSummary: '',
  issueDetails: '',
  conditionReport: '',
  honeypot: '',
};

export default function PublicRmaPage() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/rma/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: form.orderNumber,
          order_email: form.orderEmail,
          serial_number: form.serialNumber || null,
          issue_summary: form.issueSummary,
          issue_details: form.issueDetails || null,
          arrival_condition_report: form.conditionReport || null,
          honeypot: form.honeypot,
        }),
      });
      const body = await response.json();
      if (!response.ok || body.error) {
        throw new Error(body.error || 'Submission failed');
      }

      setResult(
        body.deduped
          ? 'Your request was already received and has been linked to the existing case.'
          : 'Your RMA request has been submitted successfully.'
      );
      setForm(INITIAL_STATE);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Request a Return or Repair</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          Enter your order details so we can verify ownership and open an RMA case.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              required
              value={form.orderNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, orderNumber: e.target.value }))}
              placeholder="Order number (e.g. #1001)"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            />
            <input
              type="email"
              required
              value={form.orderEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, orderEmail: e.target.value }))}
              placeholder="Order email"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>

          <input
            value={form.serialNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, serialNumber: e.target.value }))}
            placeholder="Serial number (optional)"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
          />
          <input
            required
            value={form.issueSummary}
            onChange={(e) => setForm((prev) => ({ ...prev, issueSummary: e.target.value }))}
            placeholder="Issue summary"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
          />
          <textarea
            value={form.issueDetails}
            onChange={(e) => setForm((prev) => ({ ...prev, issueDetails: e.target.value }))}
            rows={4}
            placeholder="Issue details (optional)"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
          />
          <textarea
            value={form.conditionReport}
            onChange={(e) => setForm((prev) => ({ ...prev, conditionReport: e.target.value }))}
            rows={3}
            placeholder="Arrival condition notes (optional)"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
          />

          <input
            value={form.honeypot}
            onChange={(e) => setForm((prev) => ({ ...prev, honeypot: e.target.value }))}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium"
          >
            {isSubmitting ? 'Submitting...' : 'Submit RMA Request'}
          </button>
        </form>

        {result && <p className="mt-4 text-sm text-emerald-600">{result}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
