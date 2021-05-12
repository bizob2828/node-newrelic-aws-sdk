/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'
const NR_CONFIG = Symbol('newrelic.aws-sdk-config');

module.exports = {
  name: 'sns',
  type: 'message',
  validate: (shim, AWS) => {
    if (!shim.isFunction(AWS.Client)) {
      shim.logger.debug('Could not find Client, not instrumenting.')
      return false
    }
    return true
  },
  instrument
}

function instrument(shim, AWS) {
  shim.wrap(AWS.Client.prototype, 'send', wrapClientSend)
}

function wrapClientSend(shim, send) {
  return function wrapSend(command, optsOrCb, cb) {

    this.middlewareStack.add((next, ctx) => async (args) => {
      args.request.headers[shim.DISABLE_DT] = true
      return next(args);
    }, {
      step: 'build',
    });

    this.middlewareStack.add((next, ctx) => async (args) => {
      const segment = shim.getActiveSegment()
      const result = await next(args);
      const config = args[NR_CONFIG];
      const region = await config.region();
      segment.addAttribute('aws.operation', config.operation)
      segment.addAttribute('aws.requestId', result.response.headers['x-amzn-requestid'])
      segment.addAttribute('aws.service', config.serviceId)
      segment.addAttribute('aws.region', region)
      return result;
    }, {
      step: 'deserialize',
    })

    // adding config and operation to command so we can use it after http request
    // to add as segment attrs
    command[NR_CONFIG] = { ...this.config, operation: command.constructor.name };

    return send.apply(this, arguments);
  }
}

