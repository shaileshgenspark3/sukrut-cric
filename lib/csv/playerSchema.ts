import { z } from 'zod';

const blankToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export const PlayerCSVSchema = z.object({
  'Name': z.string().min(1, 'Name is required'),
  'Classifications': z.enum(['A+', 'A', 'B', 'C', 'F']).default('B'),
  'Age': z.preprocess(blankToUndefined, z.coerce.number().int().min(15).max(50).optional()),
  'Height': z.string().optional(),
  'Handy': z.preprocess(blankToUndefined, z.enum(['Right-hand', 'Left-hand', 'Right-arm', 'Left-arm']).optional()),
  'Type': z.preprocess(blankToUndefined, z.enum(['Top-order', 'Middle-order', 'Opener', 'Finisher']).optional()),
  'Earlier Seasons': z.string().optional(),
  'Achievements': z.string().optional(),
  'Special Remarks': z.string().optional(),
  'Combat Role': z.enum(['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper']).default('Batsman'),
  'Variant': z.enum(['Male', 'Female']).default('Male'),
  'Market Base': z.coerce.number().int().min(100).default(1000),
  'Phone Number': z
    .string()
    .optional()
    .transform((value) => value?.trim() || '')
    .refine((value) => value === '' || /^\d{10}$/.test(value), {
      message: 'Phone Number must be exactly 10 digits',
    }),
});

export type PlayerCSVRow = z.infer<typeof PlayerCSVSchema>;
