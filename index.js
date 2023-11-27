class ServerlessLoggingConfig {
  constructor (serverless) {
    this.serverless = serverless
    this.log = (msgs) => console.log('serverless-logging-config:', msgs)

    this.hooks = {
      initialize: () => this.init(this),
      'before:package:initialize': () => this.disableFunctionLogs(this),
      'after:package:compileEvents': () => this.setLoggingConfig(this),
      'before:package:finalize': () => this.addIamPermissions(this)
    }
  }

  init () {
    const settings = this.serverless.service.custom?.['serverless-logging-config']
    if (!settings) {
      throw new Error(`serverless-logging-config: No custom settings found.
You need to configure this plugin by add a "serverless-logging-config" section under "custom".
For example, like this

  custom:
    serverless-logging-config:
      enableJson: true # [Optional] set the LogFormat to JSON
      logGroupName: "my-logs" # [Required] all functions to send logs to the "my-logs" log group
      applicationLogLevel: DEBUG | ERROR | FATAL | INFO | TRACE | WARN
      systemLogLevel: DEBUG | INFO | WARN

For more information about these settings, please see the service announcement here:
https://aws.amazon.com/about-aws/whats-new/2023/11/aws-lambda-controls-search-filter-aggregate-lambda-function-logs

And see this page for more info on what these settings mean:
https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-lambda-function-loggingconfig.html
  `)
    }
  }

  disableFunctionLogs () {
    const settings = this.serverless.service.custom['serverless-logging-config']
    if (!settings.logGroupName) {
      return
    }

    const exclude = settings.useDefaultLogGroup || []
    const functions = this.serverless.service.functions
    const functionNames = Object.keys(functions)
    functionNames
      .filter(x => !exclude.includes(x))
      .forEach(x => {
        functions[x].disableLogs = true
      })

    let logMsg = 'Disabled auto-generated Lambda log groups'
    if (exclude.length > 0) {
      logMsg += ` (excluding ${exclude.join(', ')})`
    }
    this.log(logMsg)
  }

  setLoggingConfig () {
    const settings = this.serverless.service.custom['serverless-logging-config']
    const exclude = settings.useDefaultLogGroup || []

    const template = this.serverless.service.provider.compiledCloudFormationTemplate
    const functions = Object
      .values(template.Resources)
      .filter(x => x.Type === 'AWS::Lambda::Function')

    for (const func of functions) {
      const isDisabled = this.isDefaultLogGroup(func, template)

      func.Properties.LoggingConfig = {
        ApplicationLogLevel: settings.applicationLogLevel,
        LogGroup: !isDisabled ? settings.logGroupName : undefined,
        LogFormat: settings.enableJson === true ? 'JSON' : 'Text',
        SystemLogLevel: settings.systemLogLevel
      }

      // after we disable the default log group, the DependsOn array will be null
      // unfortunately, some plugins like serverless-iam-roles-per-function needs
      // DependsOn to be an array, so we'll set it to an empty array if it's null
      if (!func.DependsOn) {
        func.DependsOn = []
      }
    }

    let logMsg = 'Added LoggingConfig to all the functions'
    if (exclude.length > 0) {
      logMsg += ` (excluding ${exclude.join(', ')})`
    }
    this.log(logMsg)
  }

  addIamPermissions () {
    const settings = this.serverless.service.custom['serverless-logging-config']
    if (!settings.logGroupName) {
      return
    }

    const template = this.serverless.service.provider.compiledCloudFormationTemplate
    const functions = Object
      .values(template.Resources)
      .filter(x => x.Type === 'AWS::Lambda::Function')

    const updatedRoles = []
    const updateRole = roleLogicalId => {
      if (!updatedRoles.includes(roleLogicalId)) {
        const role = template.Resources[roleLogicalId]
        if (!role) {
          this.log('Role not found:', roleLogicalId)
          return
        }

        role.Properties.Policies.forEach(x => {
          x.PolicyDocument.Statement
            .filter(stm => stm.Effect === 'Allow')
            .forEach(stm => {
              stm.Action = this.arrayify(stm.Action)
              stm.Resource = this.arrayify(stm.Resource)

              if (stm.Action.filter(act => act.startsWith('logs:')).length > 0) {
                stm.Resource.push({
                  'Fn::Sub': `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:${settings.logGroupName}:*`
                })
              }
            })
        })
      }

      updatedRoles.push(roleLogicalId)
    }

    // update the default role
    updateRole('IamRoleLambdaExecution')

    // update function roles
    functions.forEach(x => {
      const roleLogicalId = x.Properties.Role['Fn::GetAtt'][0]
      updateRole(roleLogicalId)
    })

    this.log('Added permissions to all the functions.')
  }

  arrayify (obj) {
    if (Array.isArray(obj)) {
      return obj
    } else if (typeof obj === 'string') {
      return [obj]
    } else {
      return [obj]
    }
  }

  isDefaultLogGroup (x, template) {
    if (!x.DependsOn) {
      return false
    }

    for (const dep of x.DependsOn) {
      if (dep.endsWith('LogGroup')) {
        const logGroup = template.Resources[dep]
        if (logGroup.Type === 'AWS::Logs::LogGroup') {
          return true
        }
      }
    }

    return false
  }
}

module.exports = ServerlessLoggingConfig
