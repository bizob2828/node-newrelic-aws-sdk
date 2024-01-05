/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')
const sinon = require('sinon')

tap.test('SNS', (t) => {
  t.autoend()

  let helper = null
  let sns = null
  let PublishCommand = null
  let ListTopicsCommand = null

  let server = null

  t.beforeEach(async () => {
    server = createResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    helper = utils.TestAgent.makeInstrumented()
    common.registerInstrumentation(helper)
    const newrelicLoc = utils.util.getNewRelicLocation()
    const Shim = require(newrelicLoc + '/lib/shim/message-shim')
    t.context.setLibrarySpy = sinon.spy(Shim.prototype, 'setLibrary')
    const lib = require('@aws-sdk/client-sns')
    const SNSClient = lib.SNSClient
    PublishCommand = lib.PublishCommand
    ListTopicsCommand = lib.ListTopicsCommand

    sns = new SNSClient({
      credentials: FAKE_CREDENTIALS,
      endpoint: `http://localhost:${server.address().port}`,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.destroy()
    server = null
    t.context.setLibrarySpy.restore()
    // this may be brute force but i could not figure out
    // which files within the modules were cached preventing the instrumenting
    // from running on every test
    Object.keys(require.cache).forEach((key) => {
      if (
        key.includes('@aws-sdk/client-sns') ||
        key.includes('@aws-sdk/smithy-client') ||
        key.includes('@smithy/smithy-client')
      ) {
        delete require.cache[key]
      }
    })
    helper && helper.unload()
  })

  t.test('publish with callback', (t) => {
    helper.runInTransaction((tx) => {
      const params = { Message: 'Hello!' }

      const cmd = new PublishCommand(params)
      sns.send(cmd, (err) => {
        t.error(err)
        tx.end()

        const destName = 'PhoneNumber'
        const args = [t, tx, destName]
        setImmediate(finish, ...args)
      })
    })
  })

  t.test('publish with default destination(PhoneNumber)', (t) => {
    helper.runInTransaction(async (tx) => {
      const params = { Message: 'Hello!' }

      try {
        const cmd = new PublishCommand(params)
        await sns.send(cmd)
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const destName = 'PhoneNumber'
      const args = [t, tx, destName]
      setImmediate(finish, ...args)
    })
  })

  t.test('publish with TopicArn as destination', (t) => {
    helper.runInTransaction(async (tx) => {
      const TopicArn = 'TopicArn'
      const params = { TopicArn, Message: 'Hello!' }

      try {
        const cmd = new PublishCommand(params)
        await sns.send(cmd)
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const args = [t, tx, TopicArn]
      setImmediate(finish, ...args)
    })
  })

  t.test('publish with TargetArn as destination', (t) => {
    helper.runInTransaction(async (tx) => {
      const TargetArn = 'TargetArn'
      const params = { TargetArn, Message: 'Hello!' }

      try {
        const cmd = new PublishCommand(params)
        await sns.send(cmd)
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const args = [t, tx, TargetArn]
      setImmediate(finish, ...args)
    })
  })

  t.test('publish with TopicArn as destination when both Topic and Target Arn are defined', (t) => {
    helper.runInTransaction(async (tx) => {
      const TargetArn = 'TargetArn'
      const TopicArn = 'TopicArn'
      const params = { TargetArn, TopicArn, Message: 'Hello!' }

      try {
        const cmd = new PublishCommand(params)
        await sns.send(cmd)
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const args = [t, tx, TopicArn]
      setImmediate(finish, ...args)
    })
  })

  t.test(
    'should record external segment and not a SNS segment for a command that is not PublishCommand',
    (t) => {
      helper.runInTransaction(async (tx) => {
        const TargetArn = 'TargetArn'
        const TopicArn = 'TopicArn'
        const params = { TargetArn, TopicArn, Message: 'Hello!' }

        try {
          const cmd = new ListTopicsCommand(params)
          await sns.send(cmd)
        } catch (error) {
          t.error(error)
        }

        tx.end()

        setImmediate(t.checkExternals, {
          tx,
          service: 'SNS',
          operations: ['ListTopicsCommand']
        })
      })
    }
  )

  t.test('should mark requests to be dt-disabled', (t) => {
    t.plan(2)

    helper.runInTransaction(async (tx) => {
      const params = { Message: 'Hiya' }
      const cmd = new ListTopicsCommand(params)
      sns.middlewareStack.add(
        (next) => async (args) => {
          const result = await next(args)
          const headers = result.response.body.req._headers
          t.notOk(headers.traceparent, 'should not add traceparent header to request')
          return result
        },
        { name: 'TestMw', step: 'deserialize' }
      )
      const res = await sns.send(cmd)
      tx.end()
      t.ok(res)
    })
  })
})

function finish(t, tx, destName) {
  const root = tx.trace.root

  const messages = common.checkAWSAttributes(t, root, common.SNS_PATTERN)
  t.equal(messages.length, 1, 'should have 1 message broker segment')
  t.ok(messages[0].name.endsWith(destName), 'should have appropriate destination')

  const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
  t.equal(externalSegments.length, 0, 'should not have any External segments')

  const attrs = messages[0].attributes.get(common.SEGMENT_DESTINATION)
  t.match(
    attrs,
    {
      'aws.operation': 'PublishCommand',
      'aws.requestId': String,
      'aws.service': /sns|SNS/,
      'aws.region': 'us-east-1'
    },
    'should have expected attributes for PublishCommand'
  )

  t.equal(t.context.setLibrarySpy.callCount, 1, 'should only call setLibrary once and not per call')
  t.end()
}
