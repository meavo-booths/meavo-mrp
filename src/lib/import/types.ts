export type ImportRowError = {
  row: number;
  message: string;
};

export type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
  warnings: ImportRowError[];
};

export function emptyImportResult(): ImportResult {
  return {
    ok: true,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };
}
