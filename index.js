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

    if (!settings.logGroupName) {
      throw new Error(`serverless-logging-config: You need to set the "logGroupName".
For example:

  custom:
    serverless-logging-config:
      enableJson: true # [Optional] set the LogFormat to JSON
      logGroupName: "my-logs" # [Required] all functions to send logs to the "my-logs" log group
      applicationLogLevel: DEBUG | ERROR | FATAL | INFO | TRACE | WARN
      systemLogLevel: DEBUG | INFO | WARN
      `)
    }
  }

  disableFunctionLogs () {
    const functions = this.serverless.service.functions
    Object.values(functions).forEach(x => {
      x.disableLogs = true
    })
    this.log('Disabled auto-generated Lambda log groups')
  }

  setLoggingConfig () {
    const settings = this.serverless.service.custom['serverless-logging-config']

    const template = this.serverless.service.provider.compiledCloudFormationTemplate
    const functions = Object
      .values(template.Resources)
      .filter(x => x.Type === 'AWS::Lambda::Function')

    functions.forEach(x => {
      x.Properties.LoggingConfig = {
        ApplicationLogLevel: settings.applicationLogLevel,
        LogGroup: settings.logGroupName,
        LogFormat: settings.enableJson === true ? 'JSON' : 'Text',
        SystemLogLevel: settings.systemLogLevel
      }

      // after we disable the default log group, the DependsOn array will be null
      // unfortunately, some plugins like serverless-iam-roles-per-function needs
      // DependsOn to be an array, so we'll set it to an empty array if it's null
      if (!x.DependsOn) {
        x.DependsOn = []
      }
    })

    this.log('Added LoggingConfig to all the functions.')
  }

  addIamPermissions () {
    const settings = this.serverless.service.custom['serverless-logging-config']

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
          x.PolicyDocument.Statement.forEach(stm => {
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
}

module.exports = ServerlessLoggingConfig
