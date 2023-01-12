/* eslint-disable no-undef */
import 'jest';
import { NewPipebaseConfig, PipebaseClient } from '../src/index';
require('dotenv').config()

test('TrackIngest', async () => {
  const tableName = "sdk__js_ut_track";
  const config = NewPipebaseConfig(
    process.env.PIPEBASE_TEST_WORKSPACE_ID as string,
    process.env.PIPEBASE_TEST_API_KEY as string,
  );

  const pipebaseClient = new PipebaseClient(config);
  for (var i = 0; i < 10; i++) {
    pipebaseClient.track({
      myEvent: "You can log anything you want",
      moreData: Math.random()
    }, tableName);
  }
  
  await pipebaseClient.endAsync();
});

test('IngestFromConsole', async () => {
  const tableName = "sdk__js_ut_console";
  const ingestConsoleLogs = true;
  const config = NewPipebaseConfig(
    process.env.PIPEBASE_TEST_WORKSPACE_ID as string,
    process.env.PIPEBASE_TEST_API_KEY as string,
    tableName,
    ingestConsoleLogs
  );

  const pipebaseClient = new PipebaseClient(config);

  console.info(`TEST this will be logged as info`);
  console.warn(`TEST this will be logged as warning `);
  console.error(`TEST this will be logged as error `);
  console.log("TEST parameters will also be logged", { hello: "World" }, { anotherParam: 1 }, 5, 6, 7);

  await pipebaseClient.endAsync();
});

