import { z } from 'zod';

export const updateDraftSchema = z.object({
  body: z.object({
    editedText: z.string({
      required_error: 'editedText is required and must be a string',
      invalid_type_error: 'editedText is required and must be a string',
    }),
  }),
});
