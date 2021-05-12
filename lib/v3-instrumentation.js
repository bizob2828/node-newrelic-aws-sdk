/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const helper = require('./instrumentation-helper')

module.exports = function initialize(mod, shim, AWS) {
  const instrumentation = require(`./v3-${mod}`)
  if (!instrumentation.validate(shim, AWS)) {
    return false
  }

  instrumentation.instrument(shim, AWS)
  return true
}
