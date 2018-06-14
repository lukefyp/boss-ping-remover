const bpr = require('./lib/bpr.js')
module.exports = function BPR(dispatch) {
    if (dispatch.base.majorPatchVersion >= 74) {
        console.log('boss-ping-remover - KTera definitions unsupported')
        return
    }
    bpr(dispatch)
}