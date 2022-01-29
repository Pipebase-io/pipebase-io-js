/* eslint-disable no-undef */
import 'jest';
import { Relogs } from '../src/index';
require('dotenv').config()

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


test('Playground', async () => {
  const relogs = new Relogs({
    workspaceId: process.env.RELOGS_TEST_WORKSPACE_ID as string,
    apiKey: process.env.RELOGS_TEST_API_KEY as string,
    defaultTable: 'test-js-ingest-8',
    ingestConsoleLogs: true
  });

  // const scenario = "scenario 6"

  // for (let i = 0; i < 20000; i++) {
  //   console.info(`TEST ${scenario} info - ${i}`, { hello: "world" }, i * 4);
  // }

  // for (let i = 0; i < 20000; i++) {
  //   console.warn(`TEST ${scenario} warn - ${i}`);
  // }

  // for (let i = 0; i < 30000; i++) {
  //   console.error(`TEST ${scenario} error - ${i}`);
  // }

  console.info(`TEST this will be logged as info`);
  console.warn(`TEST this will be logged as warning `);
  console.error(`TEST this will be logged as error `);
  console.log("TEST parameters will also be logged", { hello: "world" }, { anotherParam: 1 });

  await relogs.flushAsync(); // Can call flush to upload the logs (logs are flushed every second by default) 

  relogs.track({
    myEvent: "You can log anything you want",
    moreData: 1234
  }, "customTableName");

  await relogs.end(); // Flush and stop logging (will wait for logs to upload for up to 10 seconds)

  console.log(`This log will not be uploaded to Relogs`);
});