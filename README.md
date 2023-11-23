# serverless-log-config

Lets you configure custom log group, JSON logging, and other recent logging changes announce in Nov 2023.

For more information about these settings, please see the service announcement [here](https://aws.amazon.com/about-aws/whats-new/2023/11/aws-lambda-controls-search-filter-aggregate-lambda-function-logs)

Example config:

```yml
service: my-service

custom:
  serverless-logging-config:
    enableJson: true # [Optional] if enabled, set the LogFormat to JSON
    logGroupName: my-logs # [Required] all functions will send logs this log group
    applicationLogLevel: DEBUG | ERROR | FATAL | INFO | TRACE | WARN
    systemLogLevel: DEBUG | INFO | WARN
```

See [this page](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-lambda-function-loggingconfig.html) for more info on what these settings mean.

**IMPORTANT**: when used alongside the `serverless-iam-roles-per-function` plugin, make sure this plugin is listed **AFTER** `serverless-iam-roles-per-function`. ie.

```yml
plugins:  
  - serverless-iam-roles-per-function
  - serverless-log-config
```