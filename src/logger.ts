export class Logger {
  private static instance: Logger;
  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public log(message: string): void {
    console.log(message);
  }
  public error(message: string): void {
    console.error(`ERROR: ${message}`);
  }

  public warn(message: string): void {
    console.warn(`WARN: ${message}`);
  }

  public info(message: string): void {
    console.info(`INFO: ${message}`);
  }

  public debug(message: string): void {
    console.debug(`DEBUG: ${message}`);
  }
}
