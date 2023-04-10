import {writeFile} from 'fs/promises';
import {resolve} from 'path';
import {Logger} from './logger';
import {TimematorSDK} from './timemator';

(async () => {
  const logger = Logger.getInstance();
  const csvPath = resolve(__dirname, '../data/');
  const timemator = new TimematorSDK(logger);
  await timemator.init(csvPath);
  const entries = timemator.entries;

  const exportPath = resolve(__dirname, '../export/');
  writeFile(
    exportPath + '/timemator_entries.json',
    JSON.stringify(entries, null, 2)
  );
  // console.log(entries);
})();