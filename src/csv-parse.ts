import {parse} from 'csv-parse';

export async function parseAsync<T>(
  fileContent: string,
  headers: string[]
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    parse(fileContent, {columns: headers}, (err, output: T) => {
      if (err) {
        reject(err);
      }
      resolve(output);
    });
  });
}
