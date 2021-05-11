/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

module.exports = {
  name: 'sns',
  type: 'message',
  validate: (shim, AWS) => {
    if (!shim.isFunction(AWS.SNS)) {
      shim.logger.debug('Could not find SNS, not instrumenting.')
      return false
    }
    return true
  },
  instrument
}

function instrument(shim, AWS) {
  shim.setLibrary(shim.SNS)

  shim.wrap(AWS.SNSClient.prototype, 'send', function wrapSnsClient(shim, original, name) {
    shim.recordProduce(AWS.SNSClient.prototype, name, wrapClientSend)
  })
}

function wrapClientSend(shim, original, name, args, AWS) {
  const { constructor, input } = args[0]
  const type = constructor.name;
  if (type === 'PublishCommand') {
    return {
      callback: shim.LAST,
      destinationName: getDestinationName(input),
      destinationType: shim.TOPIC,
      opaque: true
    }
  }
}

function getDestinationName({TopicArn, TargetArn}) {
  return TopicArn || TargetArn || 'PhoneNumber' // We don't want the value of PhoneNumber
}
