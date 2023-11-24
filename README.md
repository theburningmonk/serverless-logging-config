# serverless-logging-config

Lets you configure custom log group, JSON logging, and other recent logging changes announce in Nov 2023.

For more information about these settings, please see the service announcement [here](https://aws.amazon.com/about-aws/whats-new/2023/11/aws-lambda-controls-search-filter-aggregate-lambda-function-logs)

## Getting started

1. Install as dev dependency:

`npm i --save-dev serverless-logging-config`

2. Add the plugin to the plugins list in your `serverless.yml`:

```yml
service: my-service

plugins:
  - serverless-logging-config
```

3. Configure the plugin in the `custom` section (you may have to add this to your `serverless.yml`). For example:

```yml
service: my-service

custom:
  serverless-logging-config:
    enableJson: true # [Optional] if enabled, set the LogFormat to JSON
    logGroupName: my-logs # [Required] all functions will send logs this log group
    applicationLogLevel: INFO # [Optional] valid values are DEBUG, ERROR, FATAL, INFO, TRACE and WARN
    systemLogLevel: INFO # [Optional] valid values are DEBUG, INFO and WARN
```

See [this page](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-lambda-function-loggingconfig.html) for more info on what these settings mean.

**IMPORTANT**: when used alongside the `serverless-iam-roles-per-function` plugin, make sure this plugin is listed **AFTER** `serverless-iam-roles-per-function`. ie.

```yml
plugins:
  - serverless-iam-roles-per-function
  - serverless-logging-config
```
