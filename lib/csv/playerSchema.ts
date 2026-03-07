import { z } from 'zod';

export const PlayerCSVSchema = z.object({
  'Name': z.string().min(1, 'Name is required'),
  'Classifications': z.enum(['A+', 'A', 'B', 'C', 'F']).default('B'),
  'Age': z.coerce.number().int().min(15).max(50).default(25),
  'Height': z.string().optional(),
  'Handy': z.enum(['Right-hand', 'Left-hand', 'Right-arm', 'Left-arm']).default('Right-hand'),
  'Type': z.enum(['Top-order', 'Middle-order', 'Opener', 'Finisher']).default('Top-order'),
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
