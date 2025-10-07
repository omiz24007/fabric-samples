'use strict';
const { Contract } = require('fabric-contract-api');

class AggContract extends Contract {
  // 集約JSONをそのまま受けて保存（検証とインデックス付けだけ行う）
  async PutAggregate(ctx, aggregateJson) {
    let a;
    try { a = JSON.parse(aggregateJson); }
    catch { throw new Error('invalid JSON'); }

    // 必須フィールドのざっくり検証
    for (const p of ['aggId','schemaVersion','source','tx','proof','createdAt']) {
      if (!(p in a)) throw new Error(`missing field: ${p}`);
    }
    if (!a.source.window) throw new Error('missing source.window');
    if (typeof a.tx.countTotal !== 'number') throw new Error('tx.countTotal must be number');

    const key = a.aggId;
    const exist = await ctx.stub.getState(key);
    if (exist && exist.length) throw new Error('aggId already exists');

    // 監査用に送信者IDを台帳側で付与
    a.clientIdentity = ctx.clientIdentity.getID();

    // 保存
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(a)));

    // LevelDBでも検索できるよう、Composite Keyで簡易インデックスを作る
    const w = a.source.window;
    const idx1 = ctx.stub.createCompositeKey('agg~window', [String(w.startBlock || 0), String(w.endBlock || 0), key]);
    await ctx.stub.putState(idx1, Buffer.from('\0'));

    const idx2 = ctx.stub.createCompositeKey('agg~channel', [a.source.channel || 'tempch', key]);
    await ctx.stub.putState(idx2, Buffer.from('\0'));

    // 通知用イベント
    await ctx.stub.setEvent('AggStored', Buffer.from(JSON.stringify({ aggId: key, count: a.tx.countTotal })));
    return 'OK';
  }

  async GetAggregate(ctx, aggId) {
    const b = await ctx.stub.getState(aggId);
    if (!b || !b.length) throw new Error('not found');
    return b.toString();
  }
}

module.exports = AggContract;
