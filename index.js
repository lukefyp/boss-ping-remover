const bpr = require('./lib/bpr.js')
module.exports = function BPR(dispatch) {
    dispatch.hookOnce('C_CHECK_VERSION', 'raw', () => {
        bpr(dispatch)
    })
}