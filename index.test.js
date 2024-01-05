const ServerlessLoggingConfig = require('./index')

describe('Gven the custom section is missing', () => {
  let serverlessMock
  let plugin

  beforeEach(() => {
    serverlessMock = {
      service: {
      }
    }

    plugin = new ServerlessLoggingConfig(serverlessMock)
  })

  test('init should throw error', () => {
    expect(() => plugin.init()).toThrow('No custom settings found')
  })
})

describe('Gven the custom.serverless-logging-config section is missing', () => {
  let serverlessMock
  let plugin

  beforeEach(() => {
    serverlessMock = {
      service: {
        custom: {
        }
      }
    }

    plugin = new ServerlessLoggingConfig(serverlessMock)
  })

  test('init should throw error', () => {
    expect(() => plugin.init()).toThrow('No custom settings found')
  })
})

describe('Given a logGroupName is not set', () => {
  let serverlessMock
  let plugin

  beforeEach(() => {
    serverlessMock = {
      service: {
        custom: {
          'serverless-logging-config': {
            enableJson: true
          }
        },
        functions: {
          hello: {
            handler: 'hello.handler'
          },
          world: {
            handler: 'world.handler'
          }
        },
        provider: {
          compiledCloudFormationTemplate: {
            Resources: {
              HelloLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                  Role: { 'Fn::GetAtt': ['IamRoleLambdaExecution'] }
                }
              },
              WorldLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                  Role: { 'Fn::GetAtt': ['IamRoleLambdaExecution'] }
                }
              },
              IamRoleLambdaExecution: {
                Type: 'AWS::IAM::Role',
                Properties: {
                  Policies: [{
                    PolicyDocument: {
                      Statement: [{
                        Action: ['logs:CreateLogGroup', 'logs:CreateLogStream'],
                        Resource: [
                          {
                            'Fn:: Sub': 'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/checkout-dev*:*:*'
                          }
                        ]
                      }]
                    }
                  }]
                }
              }
            }
          }
        }
      }
    }

    plugin = new ServerlessLoggingConfig(serverlessMock)
  })

  test('init should load settings correctly', () => {
    expect(() => plugin.init()).not.toThrow()
  })

  test('disableFunctionLogs should not disable logs for all functions', () => {
    plugin.disableFunctionLogs()
    Object.values(serverlessMock.service.functions)
      .forEach(func => {
        expect(func.disableLogs).toBeUndefined()
      })
  })

  test('setLoggingConfig should set a LoggingConfig for all functions', () => {
    plugin.setLoggingConfig()
    Object.values(serverlessMock.service.provider.compiledCloudFormationTemplate.Resources)
      .filter(x => x.Type === 'AWS::Lambda::Function')
      .forEach(resource => {
        expect(resource.Properties.LoggingConfig).toEqual({
          LogFormat: 'JSON'
        })

        expect(resource.DependsOn).toEqual([])
      })
  })

  test('addIamPermissions should not modify the shared IAM role', () => {
    plugin.addIamPermissions()
    const role = serverlessMock.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution
    expect(role).toEqual({
      Type: 'AWS::IAM::Role',
      Properties: {
        Policies: [{
          PolicyDocument: {
            Statement: [{
              Action: ['logs:CreateLogGroup', 'logs:CreateLogStream'],
              Resource: [
                {
                  'Fn:: Sub': 'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/checkout-dev*:*:*'
                }
              ]
            }]
          }
        }]
      }
    })
  })
})

describe('Given a logGroupName is set', () => {
  let serverlessMock
  let plugin
  const logGroupName = 'my-logs'

  beforeEach(() => {
    serverlessMock = {
      service: {
        custom: {
          'serverless-logging-config': {
            logGroupName
          }
        },
        functions: {
          hello: {
            handler: 'hello.handler'
          },
          world: {
            handler: 'world.handler'
          }
        },
        provider: {
          compiledCloudFormationTemplate: {
            Resources: {
              HelloLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                  Role: { 'Fn::GetAtt': ['IamRoleLambdaExecution'] }
                }
              },
              WorldLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                  Role: { 'Fn::GetAtt': ['IamRoleLambdaExecution'] }
                }
              },
              IamRoleLambdaExecution: {
                Type: 'AWS::IAM::Role',
                Properties: {
                  Policies: [{
                    PolicyDocument: {
                      Statement: [{
                        Effect: 'Allow',
                        Action: ['logs:CreateLogGroup', 'logs:CreateLogStream'],
                        Resource: ['arn:aws:logs:region:account-id:*']
                      }]
                    }
                  }]
                }
              }
            }
          }
        }
      }
    }

    plugin = new ServerlessLoggingConfig(serverlessMock)
  })

  test('init should load settings correctly', () => {
    expect(() => plugin.init()).not.toThrow()
  })

  test('disableFunctionLogs should disable logs for all functions', () => {
    plugin.disableFunctionLogs()
    Object.values(serverlessMock.service.functions)
      .forEach(func => {
        expect(func.disableLogs).toBe(true)
      })
  })

  test('setLoggingConfig should set a LoggingConfig for all functions', () => {
    plugin.setLoggingConfig()
    Object.values(serverlessMock.service.provider.compiledCloudFormationTemplate.Resources)
      .filter(x => x.Type === 'AWS::Lambda::Function')
      .forEach(resource => {
        expect(resource.Properties.LoggingConfig).toEqual({
          LogGroup: logGroupName,
          LogFormat: 'Text'
        })

        expect(resource.DependsOn).toEqual([])
      })
  })

  test('addIamPermissions should add permissions to the shared IAM role', () => {
    plugin.addIamPermissions()
    const role = serverlessMock.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource).toContainEqual({
      // eslint-disable-next-line no-template-curly-in-string
      'Fn::Sub': `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:${logGroupName}:*`
    })
  })
})

describe('Given a logGroupName is set and a function is excluded', () => {
  let serverlessMock
  let plugin
  const logGroupName = 'my-logs'

  beforeEach(() => {
    serverlessMock = {
      service: {
        custom: {
          'serverless-logging-config': {
            enableJson: true,
            logGroupName,
            useDefaultLogGroup: [
              'world'
            ]
          }
        },
        functions: {
          hello: {
            handler: 'hello.handler'
          },
          world: {
            handler: 'world.handler'
          }
        },
        provider: {
          compiledCloudFormationTemplate: {
            Resources: {
              HelloLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                  Role: { 'Fn::GetAtt': ['IamRoleLambdaExecution'] }
                }
              },
              WorldLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                  Role: { 'Fn::GetAtt': ['IamRoleLambdaExecution'] }
                }
              },
              IamRoleLambdaExecution: {
                Type: 'AWS::IAM::Role',
                Properties: {
                  Policies: [{
                    PolicyDocument: {
                      Statement: [{
                        Effect: 'Allow',
                        Action: ['logs:CreateLogGroup', 'logs:CreateLogStream'],
                        Resource: [
                          {
                            'Fn:: Sub': 'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/checkout-dev*:*:*'
                          }
                        ]
                      }]
                    }
                  }]
                }
              }
            }
          }
        }
      }
    }

    plugin = new ServerlessLoggingConfig(serverlessMock)
  })

  test('init should load settings correctly', () => {
    expect(() => plugin.init()).not.toThrow()
  })

  test('disableFunctionLogs should not disable logs for excluded function', () => {
    plugin.disableFunctionLogs()
    const [hello, world] = Object.values(serverlessMock.service.functions)
    expect(hello.disableLogs).toBe(true)
    expect(world.disableLogs).toBeUndefined()
  })

  test('setLoggingConfig should not use the shared log groug for excluded function', () => {
    const resources = serverlessMock.service.provider.compiledCloudFormationTemplate.Resources
    resources.WorldLambdaFunction.DependsOn = [
      'WorldLogGroup'
    ]
    resources.WorldLogGroup = {
      Type: 'AWS::Logs::LogGroup',
      Properties: {
        LogGroupName: '/aws/lambda/world'
      }
    }

    plugin.setLoggingConfig()
    const [hello, world] = Object.values(resources)
      .filter(x => x.Type === 'AWS::Lambda::Function')
    expect(hello.Properties.LoggingConfig).toEqual({
      LogGroup: logGroupName,
      LogFormat: 'JSON'
    })
    expect(world.Properties.LoggingConfig).toEqual({
      LogFormat: 'JSON'
    })
  })

  test('addIamPermissions should add permissions to the shared IAM role', () => {
    plugin.addIamPermissions()
    const role = serverlessMock.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource).toContainEqual({
      // eslint-disable-next-line no-template-curly-in-string
      'Fn::Sub': `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:${logGroupName}:*`
    })
  })
})

describe('Given a logGroupName is set and resource is *', () => {
  let serverlessMock
  let plugin
  const logGroupName = 'my-logs'

  beforeEach(() => {
    serverlessMock = {
      service: {
        custom: {
          'serverless-logging-config': {
            logGroupName
          }
        },
        functions: {
          hello: {
            handler: 'hello.handler'
          },
          world: {
            handler: 'world.handler'
          }
        },
        provider: {
          compiledCloudFormationTemplate: {
            Resources: {
              HelloLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                  Role: { 'Fn::GetAtt': ['IamRoleLambdaExecution'] }
                }
              },
              WorldLambdaFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                  Role: { 'Fn::GetAtt': ['IamRoleLambdaExecution'] }
                }
              },
              IamRoleLambdaExecution: {
                Type: 'AWS::IAM::Role',
                Properties: {
                  Policies: [{
                    PolicyDocument: {
                      Statement: [{
                        Effect: 'Allow',
                        Action: ['logs:CreateLogGroup', 'logs:CreateLogStream'],
                        Resource: ['*']
                      }]
                    }
                  }]
                }
              }
            }
          }
        }
      }
    }

    plugin = new ServerlessLoggingConfig(serverlessMock)
  })

  test('init should load settings correctly', () => {
    expect(() => plugin.init()).not.toThrow()
  })

  test('disableFunctionLogs should disable logs for all functions', () => {
    plugin.disableFunctionLogs()
    Object.values(serverlessMock.service.functions)
      .forEach(func => {
        expect(func.disableLogs).toBe(true)
      })
  })

  test('setLoggingConfig should set a LoggingConfig for all functions', () => {
    plugin.setLoggingConfig()
    Object.values(serverlessMock.service.provider.compiledCloudFormationTemplate.Resources)
      .filter(x => x.Type === 'AWS::Lambda::Function')
      .forEach(resource => {
        expect(resource.Properties.LoggingConfig).toEqual({
          LogGroup: logGroupName,
          LogFormat: 'Text'
        })

        expect(resource.DependsOn).toEqual([])
      })
  })

  test('addIamPermissions should leave * as is', () => {
    plugin.addIamPermissions()
    const role = serverlessMock.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource).toContainEqual('*')
  })

  test('addIamPermissions should not permissions to the shared IAM role', () => {
    plugin.addIamPermissions()
    const role = serverlessMock.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource).toContainEqual(expect.not.objectContaining({
      // eslint-disable-next-line no-template-curly-in-string
      'Fn::Sub': `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:${logGroupName}:*`
    }))
  })
})
