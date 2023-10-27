import {readFile, writeFile} from 'fs/promises';
import {Logger} from '../logger';
import {
  NSPTimesheetSDK,
  TimesheetEntry,
  keyToOrderSubprojectPhase,
} from '../nsp-timesheet-sdk/nsp-timesheet-sdk';
import {TimematorEntry, TimematorSDK, folderTaskToKey} from '../timemator-sdk';

export interface MergerOptions {
  matchFile: string;
  hashesListFile: string;
  archiveHashesListFile: string;
  nspTimesheetSDK: NSPTimesheetSDK;
  timematorSDK: TimematorSDK;
}

export class NSPTimesheetMerger {
  private _matches?: {[key: string]: string};
  private _hashes: {[hash: string]: string};

  constructor(private readonly logger: Logger, private options: MergerOptions) {
    this.logger = logger;
    this.options = options;
    this._hashes = {};
  }

  async init() {
    const {matchFile, hashesListFile} = this.options;
    this._matches = JSON.parse(await readFile(matchFile, 'utf-8'));
    try {
      this._hashes = JSON.parse(await readFile(hashesListFile, 'utf-8'));
    } catch (error) {
      this._hashes = {};
      await this.saveHashes();
    }
    if (!this._matches) {
      throw new Error('Unable to parse matches file');
    }
    return this;
  }
  get hashes() {
    return this._hashes;
  }

  async saveHashes() {
    const {hashesListFile} = this.options;
    await writeFile(hashesListFile, JSON.stringify(this._hashes, null, 2));
  }

  async archiveHashes() {
    const {archiveHashesListFile} = this.options;
    let archiveHashFile = JSON.parse(
      await readFile(archiveHashesListFile, 'utf-8')
    );

    archiveHashFile = Object.assign(archiveHashFile, this._hashes);
    await writeFile(
      archiveHashesListFile,
      JSON.stringify(archiveHashFile, null, 2)
    );
    this._hashes = {};
    await this.saveHashes();
  }

  async calculateHash(tsEntry: TimesheetEntry, timematorEntry: TimematorEntry) {
    const {duration, description, folder, task, uuid} = timematorEntry;
    const {orderId, idSubProj, phaseId} = tsEntry;
    const hash = `${uuid}-${folder}-${task}-${duration}-${orderId}-${idSubProj}-${phaseId}-${description}`;
    const buff = Buffer.from(hash);
    const base64data = buff.toString('base64');
    return base64data;
  }

  async merge() {
    let matches = this._matches;
    if (!matches) {
      await this.init();
      matches = this._matches!;
    }
    const {nspTimesheetSDK, timematorSDK} = this.options;
    const timematorEntries = timematorSDK.entries;

    for (const entry of timematorEntries) {
      const task = entry.task;
      const folder = entry.folder;
      const matchKey = folderTaskToKey(folder, task);
      const match = matches[matchKey];
      if (match) {
        // this.logger.info(`Match found for ${matchKey}: ${match}`);
        const {orderId, idSubProj, phaseId, opDeLinenumId} =
          keyToOrderSubprojectPhase(match);
        const {date, duration, description: entryDescription} = entry;
        const description = `${folder} - ${task} - ${entryDescription} - [ref.${entry.uuid}]}`;
        const tsEntry: TimesheetEntry = {
          date,
          duration,
          description,
          orderId,
          idSubProj,
          phaseId,
        };
        if (opDeLinenumId) {
          tsEntry.opDeLinenumId = opDeLinenumId;
        }

        const hash: string = await this.calculateHash(tsEntry, entry);
        if (!this._hashes[hash]) {
          try {
            const result = await nspTimesheetSDK.saveEntry(tsEntry);
            this._hashes[hash] = result;
            this.logger.info(`Saved entry: ${JSON.stringify(result)}`);
          } catch (error) {
            this.logger.error(`Unable to save entry: ${JSON.stringify(error)}`);
            await this.saveHashes();
            break;
          }
        } else {
          this.logger.warn(`Duplicate entry found for ${matchKey}`);
        }
      } else {
        this.logger.warn(`No match found for ${matchKey}`);
      }
      await this.saveHashes();
    }
  }

  async rollback() {
    const {nspTimesheetSDK} = this.options;
    for (const hash in this._hashes) {
      const entryId = this._hashes[hash];
      this.logger.info(`Deleting entry: ${entryId}`);
      try {
        await nspTimesheetSDK.deleteEntry(entryId);
        // this.logger.info(`Deleted entry: ${JSON.stringify(result)}`);
        // remove hash from _hashes
      } catch (error) {
        this.logger.error(`Unable to delete entry: ${JSON.stringify(error)}`);
      }
      delete this._hashes[hash];
      this.saveHashes();
    }
  }
}
