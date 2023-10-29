import {TimesheetManager} from './TimeSheetManager';
import {Logger} from './logger';
import {textSync} from 'figlet';
import {config as dotenvConfig} from 'dotenv';
import {writeFile} from 'fs/promises';
const {Select, Confirm} = require('enquirer');

const exportData = async (timesheetManager: TimesheetManager) => {
  const exported = await timesheetManager.exportData();
  await writeFile('./export.json', JSON.stringify(exported, null, 2));
};

(async () => {
  dotenvConfig();
  const logger = new Logger();
  try {
    const credentials = {
      username: process.env.NSP_TIMESHEET_USERNAME || '',
      password: process.env.NSP_TIMESHEET_PASSWORD || '',
    };
    logger.info(`Collected credentials for user '${credentials.username}`);
    if (!credentials.username || !credentials.password) {
      logger.error('Missing credentials');
      return;
    }

    logger.info('Creating timesheet manager');
    const timesheetManager = new TimesheetManager(logger, {
      nspTimesheet: credentials,
    });
    logger.info('Initializing timesheet manager');
    await timesheetManager.init();

    // await timesheetManager.merge();
    console.log(textSync('Timesheet Manager', {horizontalLayout: 'full'}));
    const prompt = new Select({
      name: 'color',
      message: 'Select what you want to do',
      choices: [
        {
          name: 'Merge',
          message: 'Merge timemator entries into timesheet',
          value: 'merge',
        },
        {
          name: 'Rollback',
          message: 'Rollback previous merge',
          value: 'rollback',
        },
        {
          name: 'Archive',
          message: 'Archive merged timesheets',
          value: 'archive',
        },
        {
          name: 'Import',
          message: 'Import data',
          value: 'import',
        },
        {
          name: 'Export',
          message: 'Export Projects and Tasks',
          value: 'export',
        },
        {
          name: 'Exit',
          message: 'Exit',
          value: 'exit',
        },
      ],
    });

    const commandAnswer = await prompt.run();

    if (commandAnswer === 'Exit') {
      logger.info('Exiting');
      return;
    }
    const archiveTimesheets = new Confirm({
      name: 'archive',
      message: 'Do you want to archive merged timesheet?',
    });

    let archiveAnswer;
    switch (commandAnswer) {
      case 'Merge':
        await timesheetManager.merge();
        archiveAnswer = await archiveTimesheets.run();
        break;
      case 'Rollback':
        await timesheetManager.rollback();
        break;
      case 'Export':
        await exportData(timesheetManager);
        break;
      case 'Archive':
        archiveAnswer = await archiveTimesheets.run();
        break;
      case 'Import':
        throw new Error('Not implemented');
      default:
        throw new Error('Unknown option');
    }

    if (archiveAnswer) {
      await timesheetManager.archive();
    }
  } catch (error) {
    logger.error(JSON.stringify(error, null, 2));
  }
})();

// TODO: make saving matches non destructive by doing a merge
