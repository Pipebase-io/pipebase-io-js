# pipebase-io-js

NPM package for [Pipebase.io](https://app.pipebase.io "Pipebase.io")


## Usage

1. If you don't have a Pipebase workspace, go create one (30 seconds, free): [app.pipebase.io](https://app.pipebase.io "app.pipebase.io")

1. Note your `workspace id` and `API key` ([See here](https://github.com/Pipebase-io/integrations/blob/main/images/IngestionPage-Creds.jpg "See here") on how to get them)
1. Install the package

        npm install pipebase-io-js

1. Initialize the library

    ``` Typescript
   import {PipebaseClient} from 'pipebase-io-js';

   const pipebaseClient = new PipebaseClient({
       workspaceId: "<your workspace id>",
       apiKey: "<your API key>",
       defaultTable: 'demo-ingest-from-js',
       ingestConsoleLogs: true, // if true, will upload console logs to Pipebase
       suppressConsoleLogsToConsole: true // if true, will also suppress logs to console
   })
    ```

1. Upload logs
    ``` Typescript
   console.info("TEST this will be logged as info");
   console.warn("TEST this will be logged as warning");
   console.error("TEST this will be logged as error");
   console.log("TEST parameters will also be logged", { hello: "world" }   { anotherParam: 1 });

   await pipebaseClient.flushAsync(); // Can call flush to upload the logs (log   are flushed every second by default) 

   pipebaseClient.track({
       myEvent: "You can log anything you want",
       moreData: 1234
       }, "customTableName");

   await pipebaseClient.end(); // Flush and stop logging (will wait for logs t   upload for up to 10 seconds)

   console.log(`This log will not be uploaded to Pipebase.io`);
    ```
1. You should see the logs in your workspace:
[![uploaded logs](https://github.com/Pipebase-io/pipebase-io-js/blob/master/docs/uploadedLogs.png?raw=true "uploaded logs")](https://github.com/Pipebase-io/pipebase-io-js/blob/master/docs/uploadedLogs.png?raw=true "uploaded logs")
 

## Development 

1. Install dependencies

        npm install

 
1. Run build. This will generate the compiled code with type definitions in the `dist` folder.

        npm run build

1. Formatting and linting.

        npm run lint
        npm run format

1. Run tests

        npm test

## Publish package


1. If you don't have an npm account, create one on: https://www.npmjs.com/signup or run the command: `npm adduser`

1. If you already have an account, login by running the following command:

        npm login

1. When you're successfully logged-in. Publish the package:

        npm publish

1. You should now be able to `npm install` your published package. There is an npm package called [reference-package](https://www.npmjs.com/package/reference-package) which is generated from this cookiecutter. There is a sample usage in [example/index.js](example/index.js).

## Credits
This repo was bootstrapped by following [this tutorial](https://betterprogramming.pub/build-and-publish-npm-packages-in-a-few-minutes-17494a30a51f "this tutorial").