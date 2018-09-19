const bpr = require('./lib/bpr.js')
module.exports = function BPR(dispatch) {
    bpr(dispatch, this)
}