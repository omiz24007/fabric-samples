'use strict';
const { Contract } = require('fabric-contract-api');

class TempContract extends Contract {
  async Init(ctx) { return 'OK'; }

  // 例: Put → 状態保存 ＋ チェーンコードイベント "TempTx" を発火
  async Put(ctx, key, value) {
    await ctx.stub.putState(key, Buffer.from(value));
    const ev = {
      key, value,
      txId: ctx.stub.getTxID(),
      ts: (await ctx.stub.getTxTimestamp()).seconds.low
    };
    await ctx.stub.setEvent('TempTx', Buffer.from(JSON.stringify(ev)));
    return 'OK';
  }

  async Get(ctx, key) {
    const b = await ctx.stub.getState(key);
    if (!b || b.length === 0) throw new Error('not found');
    return b.toString();
  }
}

module.exports = TempContract;
