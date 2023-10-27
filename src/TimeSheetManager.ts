import {resolve} from 'path';
import {Logger} from './logger';
import {TimematorSDK} from './timemator-sdk';
import {
  NSPTimesheetSDK,
  TimesheetEntry,
  TimesheetProject,
  orderSubprojectPhaseToKey,
} from './nsp-timesheet-sdk';
import {NSPTimesheetMerger} from './timemator-merger/NSPTimesheetMerger';
import {readFile} from 'fs/promises';

export interface TimesheetManagerConfig {
  nspTimesheet: {
    username: string;
    password: string;
  };
  paths: {
    data: string;
    export: string;
    config: string;
    archive: string;
  };
}

export interface TImesheetManagerState {
  matches: {[key: string]: string};
  hashes: {[key: string]: string};
  timesheetProjects: TimesheetProject[];
  timematorProjects: string[];
}

export class TimesheetManager {
  private readonly config: TimesheetManagerConfig;
  private timemator: TimematorSDK;
  private timesheets: NSPTimesheetSDK;
  private merger: NSPTimesheetMerger;
  private archiveHashes: {[key: string]: string};

  constructor(
    private readonly logger: Logger,
    config: Partial<TimesheetManagerConfig> &
      Pick<TimesheetManagerConfig, 'nspTimesheet'>
  ) {
    const defaultConfig: TimesheetManagerConfig = {
      nspTimesheet: {
        username: 'USERNAME',
        password: 'PASSWORD',
      },
      paths: {
        data: resolve(__dirname, '../data/'),
        export: resolve(__dirname, '../export/'),
        config: resolve(__dirname, '../config/'),
        archive: resolve(__dirname, '../export/'),
      },
    };

    this.config = {...defaultConfig, ...config};

    this.archiveHashes = {};

    this.timemator = new TimematorSDK({logger, paths: this.config.paths});

    this.timesheets = new NSPTimesheetSDK(logger, {
      username: this.config.nspTimesheet.username,
      password: this.config.nspTimesheet.password,
    });
    const paths = this.config.paths;
    this.merger = new NSPTimesheetMerger(logger, {
      matchFile: paths.config + '/matches.json',
      hashesListFile: paths.export + '/hashes.json',
      archiveHashesListFile: paths.archive + '/hashes.json',
      nspTimesheetSDK: this.timesheets,
      timematorSDK: this.timemator,
    });
  }

  public async init() {
    await this.timemator.init();
    this.logger.info(`Found ${this.timemator.entries.length} entries`);
    await this.merger.init();
    this.logger.info(`Found ${this.merger.hashes.length} hashes`);
  }

  public async listTimesheetProjects(): Promise<TimesheetProject[]> {
    const projects = await this.timesheets.getProjects();
    return projects;
  }
  public async listTimematorProjects() {
    return this.timemator.tasks;
  }

  public async getTimeshseetProjectsHashes(): Promise<{[key: string]: string}> {
    const projectMatchesEntries: {[key: string]: string} = {};
    (await this.timesheets.getProjects()).forEach(
      (project: TimesheetProject) => {
        project.phases.forEach((phase: TimesheetEntry) => {
          const key = `${project.description}/${phase.description}`;
          const value = `${orderSubprojectPhaseToKey(
            phase.orderId,
            phase.idSubProj,
            phase.phaseId
          )}`;
          projectMatchesEntries[key] = value;
        });
      }
    );
    return projectMatchesEntries;
  }

  public async merge() {
    await this.merger.merge();
  }

  public async rollback() {
    await this.merger.rollback();
  }

  public async archive() {
    await this.merger.archiveHashes();
    await this.timemator.archiveEntries();
  }

  public async exportData() {
    return {
      timematorProjects: await this.listTimematorProjects(),
      timesheetProjects: await this.listTimesheetProjects(),
      hashes: await this.getTimeshseetProjectsHashes(),
    };
  }
}
