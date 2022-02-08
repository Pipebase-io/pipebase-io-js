import axios from 'axios';
import * as _ from 'lodash';
import { waitUntil } from 'async-wait-until';

export type RelogsConfigs = {
  workspaceId: string;
  apiKey: string;
  defaultTable?: string;
  ingestConsoleLogs?: boolean;
  suppressConsoleLogsToConsole?: boolean;
};

type Event = {
  eventData: any;
  tableName: string;
};

export class Relogs {
  relogsConfigs: RelogsConfigs;
  private eventsBuffer: Event[] = [];
  private isActive: boolean = false;
  private flushIntervalId: number = -1;
  private uploadJobsInProgress: number = 0;
  private consoleFunctions: any = {};

  constructor(relogsConfigs: RelogsConfigs) {
    this.relogsConfigs = relogsConfigs;
    if (relogsConfigs.workspaceId?.length === 0 || relogsConfigs.apiKey?.length === 0) {
      console.error('No workspace id/api key');
      return;
    }

    if (relogsConfigs.ingestConsoleLogs && !relogsConfigs.defaultTable) {
      console.error('Need to define a default table name');
      return;
    }
    this.isActive = true;

    if (relogsConfigs.ingestConsoleLogs) {
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
      1000,
    );
  }

  _saveConsoleFunctions() {
    this.consoleFunctions["log"] = console.log;
    this.consoleFunctions["info"] = console.info;
    this.consoleFunctions["warn"] = console.warn;
    this.consoleFunctions["error"] = console.error;
  }

  _restoreConsoleFunctions() {
    console.log = this.consoleFunctions["log"];
    console.info = this.consoleFunctions["info"];
    console.warn = this.consoleFunctions["warn"];
    console.error = this.consoleFunctions["error"];
  }

  _getCapturingFunction = (severity: string, oldConsole: any) => {
    return (trace: any, ...args: any) => {
      if (this.isActive) {
        this.track({ severity, trace, traceArguments: args });
      }
      if (!this.isActive || !this.relogsConfigs.suppressConsoleLogsToConsole) {
        oldConsole(trace, ...args);
      }
    };
  };

  track(eventData: any, tableName: string = '') {
    this.eventsBuffer.push({ eventData, tableName });
  }

  async end() {
    this.isActive = false;
    clearInterval(this.flushIntervalId);
    if (this.relogsConfigs.ingestConsoleLogs) {
      this._restoreConsoleFunctions();
    }

    await this.flushAsync();
    await waitUntil(() => this.eventsBuffer.length === 0 && this.uploadJobsInProgress === 0, {
      timeout: 10 * 1000 /*ms*/,
    });
  }

  async flushAsync() {
    if (this.eventsBuffer.length === 0) {
      return;
    }
    this.uploadJobsInProgress++;
    const eventsBufferSnapshot = [...this.eventsBuffer];
    this.eventsBuffer = [];
    console.debug('flush called with event count:', eventsBufferSnapshot.length);
    const eventsByTables: any = _.groupBy(eventsBufferSnapshot, (e: Event) => e.tableName);

    for (const [tableName, events] of Object.entries(eventsByTables)) {
      await this.sendEventAsync(
        (events as Event[]).map((e: Event) => e.eventData),
        tableName,
      );
    }
    this.uploadJobsInProgress--;
  }

  private async sendEventAsync(eventData: Object, tableName: string = '') {
    if (tableName.length === 0 && !!this.relogsConfigs.defaultTable) {
      tableName = this.relogsConfigs.defaultTable;
    }
    await this._sendLogsToRelogsIo(tableName, eventData);
  }

  private async _sendLogsToRelogsIo(tableName: string, payload: any) {
    try {
      const response = await axios.request({
        method: 'post',
        baseURL: 'https://relogs-ingest-webhook-eus.azurewebsites.net',
        url: `/api/v1/ingest/${this.relogsConfigs.workspaceId}/${tableName}?expand=true`,
        data: payload,
        headers: {
          'X-API-KEY': `${this.relogsConfigs.apiKey}`,
          'Access-Control-Allow-Origin': true,
        },
      });
      console.debug('relogs result: ', response.status);
    } catch (error) {
      console.debug('error: ', (error as any)?.response?.data ?? error);
    }
  }
}
