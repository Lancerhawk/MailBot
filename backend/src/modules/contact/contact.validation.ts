import { z } from 'zod';

export const mergeContactSchema = z.object({
  body: z.object({
    secondaryId: z.string({
      required_error: 'secondaryId is required',
      invalid_type_error: 'secondaryId must be a string',
    }),
  }),
});
