'use strict';

const { Wallets, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// === 設定（環境変数で上書き可） ===
const CHANNEL_TEMP = process.env.TMP_CH || 'tempch';
const CHANNEL_AGG  = process.env.AGG_CH || 'aggch';
const CC_TEMP = process.env.TMP_CC || 'tempcc';
const CC_AGG  = process.env.AGG_CC || 'aggcc';
const THRESHOLD = parseInt(process.env.THRESHOLD || '10', 10);

const CCP_PATH = process.env.CCP || path.join(process.env.HOME, 'fabric-samples/applications/aggregator/connection-orgA.json');

// VM4 の peer2 MSP をそのまま使う（開発用）
const CERT_PATH = process.env.CERT || path.join(process.env.HOME, 'peer2/msp/signcerts/cert.pem');
const KEY_DIR   = process.env.KEYDIR || path.join(process.env.HOME, 'peer2/msp/keystore');

function sha256hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

// 簡易Merkle root（要素は hex 文字列配列）
function merkleRoot(hexArray) {
  if (hexArray.length === 0) return '';
  let layer = hexArray.map(h => Buffer.from(h, 'hex'));
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const L = layer[i];
      const R = layer[i + 1] || L; // 奇数なら自分を複製
      next.push(crypto.createHash('sha256').update(Buffer.concat([L, R])).digest());
    }
    layer = next;
  }
  return layer[0].toString('hex');
}

async function buildWalletIdentity() {
  const cert = fs.readFileSync(CERT_PATH, 'utf8');
  const keyFile = fs.readdirSync(KEY_DIR).find(f => f.endsWith('_sk') || f.includes('Priv') || f.length > 20);
  if (!keyFile) throw new Error('private key not found in ' + KEY_DIR);
  const key = fs.readFileSync(path.join(KEY_DIR, keyFile), 'utf8');

  const wallet = await Wallets.newInMemoryWallet();
  await wallet.put('peer2Admin', {
    credentials: { certificate: cert, privateKey: key },
    mspId: 'OrgAMSP',
    type: 'X.509'
  });
  return wallet;
}

async function main() {
  const ccp = JSON.parse(fs.readFileSync(CCP_PATH, 'utf8'));
  const wallet = await buildWalletIdentity();

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet, identity: 'peer2Admin',
    discovery: { enabled: true, asLocalhost: false }
  });

  const netTemp = await gateway.getNetwork(CHANNEL_TEMP);
  const netAgg  = await gateway.getNetwork(CHANNEL_AGG);
  const tempContract = netTemp.getContract(CC_TEMP);
  const aggContract  = netAgg.getContract(CC_AGG);

  let buffer = [];
  let startTs = null;

  await tempContract.addContractListener('tmp-listener', 'TempTx', async (event) => {
    const payload = event.payload ? JSON.parse(event.payload.toString()) : {};
    buffer.push({ txId: payload.txId, key: payload.key, value: payload.value, ts: payload.ts });
    if (!startTs) startTs = payload.ts || Math.floor(Date.now() / 1000);

    if (buffer.length >= THRESHOLD) {
      const txIds = buffer.map(x => x.txId);
      const root = merkleRoot(txIds.map(t => sha256hex(Buffer.from(t))));
      const payloadForHash = JSON.stringify({ txIds: [...txIds].sort() });
      const agg = {
        aggId: `agg-${Date.now()}`,
        schemaVersion: 1,
        source: {
          channel: CHANNEL_TEMP,
          window: { startTs: new Date(startTs * 1000).toISOString(), endTs: new Date().toISOString() }
        },
        tx: { countTotal: buffer.length, sampleTxIds: txIds.slice(0, 10) },
        proof: { merkleRootTxIds: root, type: 'merkle:txid' },
        digest: { payloadHash: sha256hex(Buffer.from(payloadForHash)) },
        createdAt: new Date().toISOString()
      };

      const t0 = Date.now();
      await aggContract.submitTransaction('PutAggregate', JSON.stringify(agg));
      const t1 = Date.now();
      console.log(JSON.stringify({ phase: 'aggregate', n: buffer.length, submit_ms: t1 - t0, aggId: agg.aggId }));

      buffer = [];
      startTs = null;
    }
  });

  console.log(`Listening '${CC_TEMP}.TempTx' on '${CHANNEL_TEMP}' (threshold=${THRESHOLD})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
