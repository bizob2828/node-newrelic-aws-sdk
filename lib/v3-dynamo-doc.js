/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const DDB_COMMAND_TYPES = [
  'PutCommand',
  'GetCommand',
  'UpdateCommand',
  'DeleteCommand',
  'BatchGet',
  'BatchWrite',
  'TransactGet',
  'TransactWrite',
  'QueryCommand',
  'ScanCommand'
]


function instrument(shim, AWS) {
  shim.setDatastore(shim.DYNAMODB)

  shim.recordOperation(
    AWS.DynamoDBDocumentClient.prototype,
    'send',
    function wrapMethod(shim, original, operationName, args) {
      let endpoint;
      // TODO: how do you handle async operations in a spec?
      this.config.endpoint().then((data) => {
        endpoint = data;
      });

      const { input: params, constructor } = args[0]

      if (DDB_COMMAND_TYPES.includes(constructor.name)) {
        return {
          name: constructor.name,
          parameters: {
            host: endpoint && endpoint.hostname,
            port_path_or_id: endpoint && endpoint.port,
            collection: params && params.TableName || 'Unknown'
          },
          callback: shim.LAST,
          opaque: true
        }
      }
    }
  )
}

module.exports = {
  name: 'dynamodb',
  type: 'datastore',
  instrument,
  validate: (shim, AWS) => {
    if (!shim.isFunction(AWS.DynamoDBDocumentClient)) {
      shim.logger.debug('Could not find DynamoDBDocumentClient, not instrumenting.')
      return false
    }
    return true
  }
}
