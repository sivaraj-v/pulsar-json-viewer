const assert = require('node:assert/strict')
const model = require('../src/selection-model.js')

const data = {
  service: 'payment',
  health: { status: 'degraded', latency: 420 },
  regions: ['us-east-1', 'eu-west-1']
}

const index = model.createIndex(data)
const selection = new model.JsonTreeSelection(index)
selection.select('/health/status')
assert.equal(selection.state('/health/status'), 'true')
assert.equal(selection.state('/health'), 'mixed')
assert.deepEqual(selection.getSelectedData(), { health: { status: 'degraded' } })
selection.select('/regions')
assert.deepEqual(selection.getSelectedData(), { health: { status: 'degraded' }, regions: ['us-east-1', 'eu-west-1'] })
selection.clearAll()
assert.equal(selection.hasSelection(), false)
assert.equal(selection.getSelectedData(), undefined)
assert.throws(() => model.createIndex({ bad: Infinity }), /finite/)
console.log('model tests passed')
