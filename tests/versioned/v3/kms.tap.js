/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('KMS Client', (t) => {
  t.autoend()
  let helper = null
  let server = null
  let service = null
  let EncryptCommand = null

  t.beforeEach(async () => {
    server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    helper = utils.TestAgent.makeInstrumented()
    common.registerCoreInstrumentation(helper)
    const { KMSClient, ...lib } = require('@aws-sdk/client-kms')
    EncryptCommand = lib.EncryptCommand
    const endpoint = `http://localhost:${server.address().port}`
    service = new KMSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.destroy()
    helper && helper.unload()
  })

  t.test('EncryptCommand', (t) => {
    helper.runInTransaction(async (tx) => {
      const cmd = new EncryptCommand({
        keyId: 'key'
      })
      await service.send(cmd)
      tx.end()
      setImmediate(common.checkExternals, {
        t,
        service: 'KMS',
        operations: ['EncryptCommand'],
        tx
      })
    })
  })
})
