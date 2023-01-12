/* eslint-disable no-unused-vars */
import axios from 'axios';
import * as _ from 'lodash';
import { waitUntil } from 'async-wait-until';

export const PIPEBASE_DEFAULT_INGESTION_ENDPOINT = 'https://pipebase.io/ingest';
export const PIPEBASE_INGEST_INTERVAL_MS = 1000;

export const PIPEBASE_FLUSH_TIMEOUT_MS = 10 * 1000;
export const PIPEBASE_FLUSH_WAIT_INTERVAL_MS = 500;

export type PipebaseConfigs = {
  workspaceId: string;
  apiKey: string;

  defaultTable?: string;
  ingestConsoleLogs?: boolean;
  suppressConsoleLogsToConsole?: boolean;

  ingestionEndpoint?: string;
  ingestInterval?: number;
  flushTimeout?: number;
  flushCheckInterval?: number;
};

export function NewPipebaseConfig(
  workspaceId: string,
  apiKey: string,
  defaultTable: string = '',
  ingestConsoleLogs: boolean = false,
  suppressConsoleLogsToConsole: boolean = false,
) {
  const config = updateDefaultConfigParameters({
    workspaceId: workspaceId,
    apiKey: apiKey,
    defaultTable: defaultTable,
    ingestConsoleLogs: ingestConsoleLogs,
    suppressConsoleLogsToConsole: suppressConsoleLogsToConsole,
  });

  validateConfig(config);
  return config;
}

export interface IPipebaseClient {
  track: (eventData: any, tableName: string) => void;
  endAsync: () => Promise<void>;
  flushAsync: () => Promise<void>;
  isIngestionCompleted: () => boolean;
}

export class PipebaseClient implements IPipebaseClient {
  //#region Private Members
  config: PipebaseConfigs;
  private eventsBuffer: { [tableName: string]: any[] } = {};
  private flushIntervalId: number | undefined = undefined;
  private uploadJobsInProgress: number = 0;
  private consoleFunctions: any = {};
  //#endregion

  //#region Constructors
  constructor(config: PipebaseConfigs) {
    if (!config) {
      throw Error('Config must be provided');
    }

    if (!config.apiKey || !config.workspaceId) {
      console.error('No workspace id or api key provided');
      throw Error('No workspace id or api key provided');
    }

    if (config.ingestConsoleLogs && !config.defaultTable) {
      throw Error('defaultTable must be provided when ingestConsoleLogs enabled');
    }

    this.config = updateDefaultConfigParameters(config);
    logConfig(this.config);

    if (config.ingestConsoleLogs) {
      this._saveConsoleFunctions();
      console.log = this._getCapturingFunction('Info', console.log);
      console.info = this._getCapturingFunction('Info', console.info);
      console.warn = this._getCapturingFunction('Warning', console.warn);
      console.error = this._getCapturingFunction('Error', console.error);
    }

    this.flushIntervalId = setInterval(
      (() => {
        this.flushAsync();
      }) as Function,
      config.ingestInterval,
    );
  }
  //#endregion

  //#region Public Methods
  track(eventData: any, tableName: string = '') {
    if (!tableName && !this.config.defaultTable) {
      console.error('No table provided and default table is not set');
    }

    let finalTableName = !tableName ? (this.config.defaultTable as string) : tableName;
    if (!(finalTableName in this.eventsBuffer)) {
      this.eventsBuffer[finalTableName] = [eventData];
    } else {
      this.eventsBuffer[finalTableName].push(eventData);
    }
  }

  async endAsync() {
    clearInterval(this.flushIntervalId);
    if (this.config.ingestConsoleLogs) {
      this._restoreConsoleFunctions();
    }

    await this.flushAsync();
    await waitUntil(() => this.isIngestionCompleted(), {
      timeout: this.config.flushTimeout,
      intervalBetweenAttempts: this.config.flushCheckInterval,
    });
  }

  async flushAsync() {
    const buffer = { ...this.eventsBuffer };
    this.eventsBuffer = {};
    for (let tableName in buffer) {
      await this._flushTableAsync(tableName, buffer[tableName]);
    }
  }

  isIngestionCompleted(): boolean {
    return Object.keys(this.eventsBuffer).length === 0 && this.uploadJobsInProgress === 0;
  }
  //#endregion

  //#region Private Methods
  private _saveConsoleFunctions() {
    this.consoleFunctions['log'] = console.log;
    this.consoleFunctions['info'] = console.info;
    this.consoleFunctions['warn'] = console.warn;
    this.consoleFunctions['error'] = console.error;
  }

  private _restoreConsoleFunctions() {
    console.log = this.consoleFunctions['log'];
    console.info = this.consoleFunctions['info'];
    console.warn = this.consoleFunctions['warn'];
    console.error = this.consoleFunctions['error'];
  }

  private _getCapturingFunction = (severity: string, oldConsole: any) => {
    return (trace: any, ...args: any) => {
      this.track({ severity, trace, traceArguments: args }, this.config.defaultTable);

      if (!this.config.suppressConsoleLogsToConsole) {
        oldConsole(trace, ...args);
      }
    };
  };

  private async _flushTableAsync(tableName: string, events: any[]) {
    console.debug(`Flushing to table '${tableName}' with event count: ${events.length}`);

    this.uploadJobsInProgress++;
    const result = await this._sendLogsToPipebaseIo(tableName, events);
    this.uploadJobsInProgress--;

    console.info(`Flushing to table '${tableName}' ended with result: ${result}`);
  }

  private async _sendLogsToPipebaseIo(tableName: string, payload: any) {
    try {
      const response = await axios.request({
        method: 'post',
        baseURL: this.config.ingestionEndpoint,
        url: `/v1/${this.config.workspaceId}/${tableName}?expand=true`,
        data: payload,
        headers: {
          'X-API-KEY': `${this.config.apiKey}`,
          'Access-Control-Allow-Origin': true,
        },
      });

      console.debug('result: ', response.status);
      return response.status;
    } catch (error) {
      console.debug('error: ', (error as any)?.response?.data ?? error);
      return (error as any)?.response?.status ?? -1;
    }
  }
  //#endregion
}

function validateConfig(config: PipebaseConfigs) {
  if (!config) {
    throw Error('Config must be provided');
  }

  if (!config.apiKey || !config.workspaceId) {
    console.error('No workspace id or api key provided');
    throw Error('No workspace id or api key provided');
  }

  if (config.ingestConsoleLogs && !config.defaultTable) {
    throw Error('defaultTable must be provided when ingestConsoleLogs enabled');
  }
}

function logConfig(config: PipebaseConfigs) {
  const configToLog = { ...config, apiKey: config.apiKey ? '****' : '' };
  console.log(configToLog);
}

function updateDefaultConfigParameters(pipebaseConfig: PipebaseConfigs): PipebaseConfigs {
  let config = { ...pipebaseConfig };
  if (!config.ingestionEndpoint) {
    config.ingestionEndpoint = PIPEBASE_DEFAULT_INGESTION_ENDPOINT;
  }

  if (!config.ingestInterval || config.ingestInterval <= 0) {
    config.ingestInterval = PIPEBASE_INGEST_INTERVAL_MS;
  }

  if (!config.flushTimeout || config.flushTimeout <= 0) {
    config.flushTimeout = PIPEBASE_FLUSH_TIMEOUT_MS;
  }

  if (!config.flushCheckInterval || config.flushCheckInterval <= 0) {
    config.flushCheckInterval = PIPEBASE_FLUSH_WAIT_INTERVAL_MS;
  }

  return config;
}
