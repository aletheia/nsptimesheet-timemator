import axios, {AxiosError} from 'axios';
import {Logger} from '../logger';

export interface NSPTimesheetSDKOptions {
  username: string;
  password: string;
  config?: NSPTimesheetConfig;
}

export interface NSPTimesheetCredentials {
  tokenType: string;
  accessToken: string;
  expirationDate: Date;
}

export interface NSPTimesheetConfig {
  loginUrl: () => string;
  dashboardUrl: (fromDate: string, toDate: string) => string;
  treeUrl: () => string;
  addEntryUrl: () => string;
  updateEntryUrl: (id: string) => string;
}

export interface TimesheetEntry {
  date: Date;
  duration: number;
  description: string;
  orderId: string;
  idSubProj: string;
  phaseId: string;
  opDeLinenumId?: string;
}

export interface TimesheetEntryTO {
  date: string;
  description: string;
  orderId: string;
  phaseId: string;
  idSubPrj: string;
  userId: string;
  company: string;
  status: string;
  siteId: string;
  hours: number;
  billingHours: number;
  tripHours: number;
  opDeLinenumId: string;
  centroId: string;
}

export interface ProjectSite {
  siteId: string;
  description: string;
}

export interface TimesheetProject {
  id: string;
  description: string;
  customerId?: string;
  customerName?: string;
  ordType?: string;
  phases: TimesheetEntry[];
  sites: ProjectSite[];
}

export const orderSubprojectPhaseToKey = (
  orderId: string,
  idSubProj: string,
  phaseId: string
): string => {
  return `${orderId}/${idSubProj}/${phaseId}`;
};

export const keyToOrderSubprojectPhase = (
  key: string
): {
  orderId: string;
  idSubProj: string;
  phaseId: string;
  opDeLinenumId?: string;
} => {
  let orderId, idSubProj, phaseId, opDeLinenumId;
  const split = key.split('/');
  if (split.length < 3) {
    throw new Error('Invalid key');
  } else if (split.length === 3) {
    [orderId, idSubProj, phaseId] = split;
  } else {
    [orderId, idSubProj, phaseId, opDeLinenumId] = split;
  }
  return {orderId, idSubProj, phaseId, opDeLinenumId};
};

const defaultSdkConfig: NSPTimesheetConfig = {
  loginUrl: () =>
    'https://timesheets-api.neosperience.com/token/oauth2/NEOSPERIENCE',
  dashboardUrl: (fromDate: string, toDate: string) =>
    `https://timesheets-api.neosperience.com/timesheets?from=${fromDate}&to=${toDate}`,
  treeUrl: () => 'https://timesheets-api.neosperience.com/orders/tree',
  addEntryUrl: () => 'https://timesheets-api.neosperience.com/timesheets',
  updateEntryUrl: (id: string) =>
    `https://timesheets-api.neosperience.com/timesheets/${id}`,
};

const entryDefaultData: Partial<TimesheetEntryTO> & {
  userId: string;
  company: string;
  status: string;
  siteId: string;
  tripHours: number;
  opDeLinenumId: string;
  centroId: string;
} = {
  userId: '18',
  company: 'NEOSPERIENCE',
  status: 'DRAFT',
  siteId: 'SmartW',
  tripHours: 0,
  opDeLinenumId: '328_0',
  centroId: 'Generale',
};

export class NSPTimesheetSDK {
  private options: NSPTimesheetSDKOptions;
  private credentials?: NSPTimesheetCredentials;
  constructor(
    private readonly logger: Logger,
    options: NSPTimesheetSDKOptions
  ) {
    this.logger = logger;
    this.options = options;
    this.options.config = options.config || defaultSdkConfig;
  }

  async login() {
    this.logger.info('Logging in...');
    this.logger.info(`Username: ${this.options.username}`);
    try {
      const response = await axios.post(
        defaultSdkConfig.loginUrl(),
        {
          username: this.options.username,
          password: this.options.password,
          grant_type: 'password',
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      this.credentials = {
        tokenType: response.data.token_type,
        accessToken: response.data.access_token,
        expirationDate: new Date(Date.now() + response.data.expires_in * 1000),
      };
      return this.credentials;
    } catch (error) {
      const errorResponse = error as AxiosError;
      // this.logger.error(JSON.stringify(errorResponse, null, 2));
      throw new Error("Couldn't login");
    }
  }

  private async getHttpHeadersWithAuth() {
    let credentials = this.credentials;
    if (!credentials) {
      credentials = await this.login();
    }
    return {
      Authorization: `Bearer ${credentials.accessToken}`,
      ContentType: 'application/json',
      Accept: 'application/json',
    };
  }

  async getProjects(): Promise<TimesheetProject[]> {
    const headers = await this.getHttpHeadersWithAuth();
    const response = await axios.get(defaultSdkConfig.treeUrl(), {
      headers,
    });
    return response.data.map((project: any) => {
      const phases: TimesheetEntry[] = project.phases.map((phase: any) => {
        return {
          date: new Date(phase.date),
          duration: phase.hours,
          description: phase.description,
          orderId: project.orderId,
          idSubProj: phase.idSubPRJ,
          phaseId: phase.phaseId,
          opDeLinenumId: phase.opDeLinenumId,
        };
      });
      return {
        id: project.id,
        description: project.description,
        customerId: project.customerId,
        customerName: project.customerName,
        ordType: project.ordType,
        phases,
        sites: project.sites,
      };
    });
  }

  async deleteEntry(id: string) {
    const headers = await this.getHttpHeadersWithAuth();
    const response = await axios.delete(defaultSdkConfig.updateEntryUrl(id), {
      headers,
    });
    return response.data;
  }

  async saveEntry(entry: {
    date: Date;
    duration: number;
    description: string;
    orderId: string;
    idSubProj: string;
    phaseId: string;
  }): Promise<string> {
    const {date, duration, description, orderId, idSubProj, phaseId} = entry;

    const hours: number = parseFloat(duration.toString());

    const realMonth = date.getMonth() + 1;
    const month = realMonth < 10 ? `0${realMonth}` : realMonth.toString();
    const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();

    const nspTsEntry: TimesheetEntryTO = Object.assign(entryDefaultData, {
      orderId,
      idSubPrj: idSubProj,
      date: `${date.getFullYear()}-${month}-${day}`,
      hours,
      billingHours: hours,
      phaseId,
      description,
    });

    const headers = await this.getHttpHeadersWithAuth();
    // this.logger.info('Posting to: ' + defaultSdkConfig.addEntryUrl());
    // this.logger.info(`Headers:\n ${JSON.stringify(headers, null, 2)} `);
    // this.logger.info(`Saving entry:\n ${JSON.stringify(nspTsEntry, null, 2)} `);

    try {
      const res = await axios.post(defaultSdkConfig.addEntryUrl(), nspTsEntry, {
        headers,
      });
      return res.data.id as unknown as string;
    } catch (e) {
      const error = e as AxiosError;
      if (error.response) {
        const errorInfo = error.response.data as {
          statusCode: number;
          statusReason: string;
          message: string;
          details: string[];
        };
        const message =
          `${errorInfo.statusReason} (${errorInfo.statusCode}): ` +
          `${errorInfo.message} - ${errorInfo.details.join(', ')}\n` +
          `Entry:\n${JSON.stringify(nspTsEntry, null, 2)}`;
        // this.logger.error(message);
        error.message = message;
      }
      throw error;
    }
  }
}
