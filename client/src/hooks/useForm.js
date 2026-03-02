import { useState, useCallback } from 'react';

/**
 * Hook for form state management with submit handling.
 *
 * Usage:
 *   const { form, setField, setForm, reset, submitting, handleSubmit } = useForm({
 *     title: '',
 *     amount: '',
 *     category: 'other',
 *   });
 *
 *   // In input: onChange={(e) => setField('title', e.target.value)}
 *   // Or: onChange={handleChange}  (auto-extracts name/value from event)
 *   // Submit: handleSubmit(async (formData) => { await api.post('/endpoint', formData); })
 */
export function useForm(initialValues) {
  const [form, setForm] = useState(initialValues);
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }, []);

  const reset = useCallback(() => setForm(initialValues), [initialValues]);

  const handleSubmit = useCallback(
    async (submitFn) => {
      setSubmitting(true);
      try {
        await submitFn(form);
      } finally {
        setSubmitting(false);
      }
    },
    [form]
  );

  return { form, setForm, setField, handleChange, reset, submitting, handleSubmit };
}
