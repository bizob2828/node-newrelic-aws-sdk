/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const {grabLastUrlSegment} = require('./util')
module.exports = {
  name: 'sqs',
  type: 'message',
  validate,
  instrument
}

function validate(shim, AWS) {
  if (!shim.isFunction(AWS.SQS)) {
    shim.logger.debug('Could not find AWS.SQS')

    return false
  }

  return true
}

function instrument(shim, AWS) {
  // This needs to happen before any instrumentation
  shim.setLibrary(shim.SQS)
  // If/when we do this for real we should extract out the recording of a consumer/producer from the wrapping
  // of the module so it doesn't have to be double wrapped but instead just be
  // shim.wrap(AWS.SQSClient.prototype, 'send', recordMessageApi)
  // recordMessageApi would also call the standalone produce/consume recorders
  shim.recordProduce(AWS.SQSClient.prototype, 'send', recordMessageApi.bind(null, 'produce'))
  shim.recordConsume(AWS.SQSClient.prototype, 'send', recordMessageApi.bind(null, 'consume'))
}

function recordMessageApi(type, shim, original, name, args) {
  const { input: params, constructor } = args[0]
  if (
    constructor.name === 'ReceiveMessageCommand' && type === 'consume' ||
    constructor.name === 'SendMessageCommand' && type === 'produce' ||
    constructor.name === 'SendMessageBatchCommand' && type === 'produce'
  ) {
    const queueName = grabLastUrlSegment(params.QueueUrl)

    return {
      callback: shim.LAST,
      destinationName: queueName,
      destinationType: shim.QUEUE,
      opaque: true
    }
  }
}


