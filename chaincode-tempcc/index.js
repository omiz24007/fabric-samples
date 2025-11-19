'use strict';
const { Contract } = require('fabric-contract-api');

class TempCC extends Contract {
  async Init(ctx) {
    return 'OK';
  }

  async Put(ctx, key, value) {
    // 台帳に書き込む
    await ctx.stub.putState(key, Buffer.from(value));

    // イベント用のペイロードを組み立てる
    const ev = {
      key,
      value,
      txId: ctx.stub.getTxID(),
      ts: (await ctx.stub.getTxTimestamp()).seconds.low
    };

    // TempTx イベントを発火
    await ctx.stub.setEvent('TempTx', Buffer.from(JSON.stringify(ev)));

    return 'OK';
  }

  async Get(ctx, key) {
    const b = await ctx.stub.getState(key);
    if (!b || b.length === 0) {
      throw new Error('not found');
    }
    return b.toString();
  }
}

module.exports.contracts = [ TempCC ];
