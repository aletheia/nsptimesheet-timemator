import {resolve} from 'path';
import {Logger} from './logger';
import {NSPTimesheetSDK} from './nsp-timesheet-sdk';
import {NSPTimesheetMerger} from './timemator-merger/NSPTimesheetMerger';
import {TimematorSDK} from './timemator-sdk/timemator';

(async () => {
  const logger = new Logger();
  const dataPath = resolve(__dirname, '../data/');
  const exportPath = resolve(__dirname, '../export/');
  const configPath = resolve(__dirname, '../config/');
  const timemator = new TimematorSDK(logger);
  await timemator.init(dataPath);
  const entries = timemator.entries.sort((a, b) => {
    return a.date.getTime() - b.date.getTime();
  });

  logger.info(`Found ${entries.length} entries`);

  const timesheets = new NSPTimesheetSDK(logger, {
    username: 'luca.bianchi@neosperience.com',
    password: 'Askan1s0n',
  });

  const merger = await new NSPTimesheetMerger(logger, {
    matchFile: configPath + '/matches.json',
    hashesListFile: exportPath + '/hashes.json',
    nspTimesheetSDK: timesheets,
    timematorSDK: timemator,
  }).init();

  await merger.merge();

  // const projects = await timesheets.getProjects();
  //  console.log(projects);
})();
