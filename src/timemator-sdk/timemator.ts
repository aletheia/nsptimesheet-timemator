import {readFile, readdir} from 'fs/promises';
import {parseAsync} from '../csv-parse';
import {Logger} from '../logger';

export interface TimematorCsvEntry {
  unix_begin: number;
  unix_end: number;
  date: Date;
  begin: string;
  end: string;
  folder: string;
  task: string;
  duration: string;
  duration_decimal: number;
  rounding_to: number;
  rounding_method: string;
  hourly_rate: number;
  revenue: number;
  billing_status: string;
  notes: string;
}

export type TimematorEntry = {
  uuid: string;
  date: Date;
  folder: string;
  task: string;
  duration: number;
  hourlyRate: number;
  description: string;
};

export const folderTaskToKey = (folder: string, task: string): string => {
  return `${folder ? folder + '/' : ''}${task}`;
};

export const keyToFolderTask = (
  key: string
): {folder: string; task: string} => {
  const [folder, task] = key.split('/');
  return {folder, task};
};

export const readTimematorCsv = async (
  csvFile: string
): Promise<TimematorCsvEntry[]> => {
  const headers = [
    'unix_begin',
    'unix_end',
    'date',
    'begin',
    'end',
    'folder',
    'task',
    'duration',
    'duration_decimal',
    'rounding_to',
    'rounding_method',
    'hourly_rate',
    'revenue',
    'billing_status',
    'notes',
  ];
  const fileContent = await readFile(csvFile, 'utf-8');

  return await parseAsync<TimematorCsvEntry[]>(fileContent, headers);
};

export const unmarshallTimematorCsv = async (
  csv: TimematorCsvEntry[]
): Promise<TimematorEntry[]> => {
  const entries: TimematorEntry[] = [];
  for (const data of csv) {
    const uuid = data.unix_begin + '' + data.unix_end;
    const entry: TimematorEntry = {
      uuid,
      date: new Date(data.date),
      folder: data.folder,
      task: data.task,
      duration: data.duration_decimal,
      hourlyRate: data.hourly_rate,
      description: data.notes,
    };
    entries.push(entry);
  }
  return entries;
};

export const parseTimematorCsv = async (
  csvPath: string
): Promise<TimematorEntry[]> => {
  const csv = await readTimematorCsv(csvPath);
  return unmarshallTimematorCsv(csv);
};

export const makeUniqueEntries = (entries: TimematorEntry[]) => {
  const uniqueEntries: TimematorEntry[] = [];
  const uuids: string[] = [];
  for (const entry of entries) {
    if (!uuids.includes(entry.uuid)) {
      uniqueEntries.push(entry);
      uuids.push(entry.uuid);
    }
  }
  return uniqueEntries;
};

export class TimematorSDK {
  private _entries: TimematorEntry[];

  constructor(private readonly logger: Logger) {
    this._entries = [];
  }

  async init(folder: string) {
    const entries = [];
    const files = await readdir(folder);
    for (const file of files) {
      if (file.endsWith('.csv')) {
        this.logger.info(`Processing file: ${file}`);
        entries.push(...(await parseTimematorCsv(folder + '/' + file)));
      }
    }
    this._entries = makeUniqueEntries(entries);
    this.logger.info(`Found ${entries.length} unique entries`);
  }
  get entries() {
    return this._entries.sort((a, b) => {
      return a.date.getTime() - b.date.getTime();
    });
  }

  get tasks(): string[] {
    const tasks = new Set<string>();
    for (const entry of this._entries) {
      const task = entry.folder ? `${entry.folder}/${entry.task}` : entry.task;
      tasks.add(task);
    }
    return Array.from(tasks.values());
  }
}
