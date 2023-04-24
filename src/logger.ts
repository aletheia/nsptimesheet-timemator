import {createLogger, format, transports, Logger as WLogger} from 'winston';

// create a logger class using winston
export class Logger {
  private instance: WLogger;
  constructor() {
    this.instance = createLogger({
      level: 'info',
      format: format.json(),
      // defaultMeta: {service: 'user-service'},
      transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log`
        // - Write all logs error (and below) to `error.log`.
        //
        new transports.File({filename: 'error.log', level: 'error'}),
        new transports.File({filename: 'combined.log'}),
      ],
    });

    if (process.env.NODE_ENV !== 'production') {
      this.instance.add(
        new transports.Console({
          format: format.simple(),
        })
      );
    }
  }

  info(message: string | object) {
    if (typeof message === 'object') {
      message = JSON.stringify(message, null, 2);
    }
    this.instance.info(message);
  }
  warn(message: string | object) {
    if (typeof message === 'object') {
      message = JSON.stringify(message, null, 2);
    }

    this.instance.warn(message);
  }

  error(message: string | object) {
    if (typeof message === 'object') {
      message = JSON.stringify(message, null, 2);
    }

    this.instance.error(message);
  }

  debug(message: string | object) {
    if (typeof message === 'object') {
      message = JSON.stringify(message, null, 2);
    }

    this.instance.debug(message);
  }

  verbose(message: string | object) {
    if (typeof message === 'object') {
      message = JSON.stringify(message, null, 2);
    }

    this.instance.verbose(message);
  }
}
