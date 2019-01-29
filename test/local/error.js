/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const { assert } = require('chai')
const messages = require('joi/lib/language')
const AppError = require('../../lib/error')
const P = require('../../lib/promise')

describe('AppErrors', () => {

  it(
    'tightly-coupled joi message hack is okay',
    () => {
      assert.equal(typeof messages.errors.any.required, 'string')
      assert.notEqual(messages.errors.any.required, '')
    }
  )

  it(
    'exported functions exist',
    () => {
      assert.equal(typeof AppError, 'function')
      assert.equal(AppError.length, 3)
      assert.equal(typeof AppError.translate, 'function')
      assert.equal(AppError.translate.length, 1)
      assert.equal(typeof AppError.invalidRequestParameter, 'function')
      assert.equal(AppError.invalidRequestParameter.length, 1)
      assert.equal(typeof AppError.missingRequestParameter, 'function')
      assert.equal(AppError.missingRequestParameter.length, 1)
    }
  )

  it(
    'should translate with missing required parameters',
    () => {
      var result = AppError.translate({
        output: {
          payload: {
            message: 'foo' + messages.errors.any.required,
            validation: {
              keys: [ 'bar', 'baz' ]
            }
          }
        }
      })
      assert.ok(result instanceof AppError, 'instanceof AppError')
      assert.equal(result.errno, 108)
      assert.equal(result.message, 'Missing parameter in request body: bar')
      assert.equal(result.output.statusCode, 400)
      assert.equal(result.output.payload.error, 'Bad Request')
      assert.equal(result.output.payload.errno, result.errno)
      assert.equal(result.output.payload.message, result.message)
      assert.equal(result.output.payload.param, 'bar')
    }
  )

  it(
    'should translate with invalid parameter',
    () => {
      var result = AppError.translate({
        output: {
          payload: {
            validation: 'foo'
          }
        }
      })
      assert.ok(result instanceof AppError, 'instanceof AppError')
      assert.equal(result.errno, 107)
      assert.equal(result.message, 'Invalid parameter in request body')
      assert.equal(result.output.statusCode, 400)
      assert.equal(result.output.payload.error, 'Bad Request')
      assert.equal(result.output.payload.errno, result.errno)
      assert.equal(result.output.payload.message, result.message)
      assert.equal(result.output.payload.validation, 'foo')
    }
  )

  it(
    'should translate with missing payload',
    () => {
      var result = AppError.translate({
        output: {}
      })
      assert.ok(result instanceof AppError, 'instanceof AppError')
      assert.equal(result.errno, 999)
      assert.equal(result.message, 'Unspecified error')
      assert.equal(result.output.statusCode, 500)
      assert.equal(result.output.payload.error, 'Internal Server Error')
      assert.equal(result.output.payload.errno, result.errno)
      assert.equal(result.output.payload.message, result.message)
    }
  )

  it(
    'tooManyRequests',
    () => {
      var result = AppError.tooManyRequests(900, 'in 15 minutes')
      assert.ok(result instanceof AppError, 'instanceof AppError')
      assert.equal(result.errno, 114)
      assert.equal(result.message, 'Client has sent too many requests')
      assert.equal(result.output.statusCode, 429)
      assert.equal(result.output.payload.error, 'Too Many Requests')
      assert.equal(result.output.payload.retryAfter, 900)
      assert.equal(result.output.payload.retryAfterLocalized, 'in 15 minutes')

      result = AppError.tooManyRequests(900)
      assert.equal(result.output.payload.retryAfter, 900)
      assert(! result.output.payload.retryAfterLocalized)

    }
  )

  it('unexpectedError without request data', () => {
    const err = AppError.unexpectedError()
    assert.instanceOf(err, AppError)
    assert.instanceOf(err, Error)
    assert.equal(err.errno, 999)
    assert.equal(err.message, 'Unspecified error')
    assert.equal(err.output.statusCode, 500)
    assert.equal(err.output.payload.error, 'Internal Server Error')
    assert.isUndefined(err.output.payload.request)
  })

  it('unexpectedError with request data', () => {
    const err = AppError.unexpectedError({
      app: {
        acceptLanguage: 'en, fr',
        locale: 'en',
        geo: {
          city: 'Mountain View',
          state: 'California'
        },
        ua: {
          os: 'Android',
          osVersion: '9'
        },
        devices: P.resolve([ { id: 1 } ]),
        metricsContext: P.resolve({
          service: 'sync'
        })
      },
      method: 'GET',
      path: '/v1/wibble',
      query: {
        foo: 'bar'
      },
      payload: {
        baz: 'qux'
      },
      headers: {
        wibble: 'blee'
      }
    })
    assert.equal(err.errno, 999)
    assert.equal(err.message, 'Unspecified error')
    assert.equal(err.output.statusCode, 500)
    assert.equal(err.output.payload.error, 'Internal Server Error')
    assert.deepEqual(err.output.payload.request, {
      acceptLanguage: 'en, fr',
      locale: 'en',
      geo: {
        city: 'Mountain View',
        state: 'California'
      },
      userAgent: {
        os: 'Android',
        osVersion: '9'
      },
      method: 'GET',
      path: '/v1/wibble',
      query: {
        foo: 'bar'
      },
      payload: {
        baz: 'qux'
      },
      headers: {
        wibble: 'blee'
      }
    })
  })

  const reasons = ['socket hang up', 'ECONNREFUSED'];
  reasons.forEach((reason) => {
    it(`converts ${reason} errors to backend service error`, () => {
      const result = AppError.translate({
        output: {
          payload: {
            errno: 999,
            statusCode: 500
          }
        },
        reason
      })

      assert.ok(result instanceof AppError, 'instanceof AppError')
      assert.equal(result.errno, 203)
      assert.equal(result.message, 'A backend service request failed.')
      assert.equal(result.output.statusCode, 500)
      assert.equal(result.output.payload.error, 'Internal Server Error')
      assert.equal(result.output.payload.errno, AppError.ERRNO.BACKEND_SERVICE_FAILURE)
      assert.equal(result.output.payload.message, 'A backend service request failed.')
    })
  })
})
