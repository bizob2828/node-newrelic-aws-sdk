/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

module.exports = [
  {
    type: 'conglomerate',
    moduleName: 'aws-sdk',
    onRequire: require('./lib/instrumentation')
  },
  {
    type: 'message',
    moduleName: '@aws-sdk/client-sqs',
    onRequire: require('./lib/v3-instrumentation').bind(null, 'sqs')
  },
  {
    type: 'message',
    moduleName: '@aws-sdk/client-sns',
    onRequire: require('./lib/v3-instrumentation').bind(null, 'sns')
  },
  {
    type: 'datastore',
    moduleName: '@aws-sdk/client-dynamodb',
    onRequire: require('./lib/v3-instrumentation').bind(null, 'dynamodb')
  },
  {
    type: 'datastore',
    moduleName: '@aws-sdk/lib-dynamodb',
    onRequire: require('./lib/v3-instrumentation').bind(null, 'dynamo-doc')
  },
  {
    type: 'generic',
    moduleName: '@aws-sdk/smithy-client',
    onRequire: require('./lib/v3-instrumentation').bind(null, 'smithy')
  }
]
