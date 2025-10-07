#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/env.sh"

CC_NAME=tempcc
CC_PATH="$HOME/fabric-samples/chaincode-tempcc"
LABEL=${CC_NAME}_1
CHAN=tempch

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_MSPCONFIGPATH="$HOME/peer0/msp"
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode package "/tmp/${CC_NAME}.tgz" --path "$CC_PATH" --lang node --label "$LABEL"
peer lifecycle chaincode install "/tmp/${CC_NAME}.tgz"

scp "/tmp/${CC_NAME}.tgz" fabric@vm3:/tmp/
ssh fabric@vm3 'export FABRIC_HOME=$HOME/fabric; export PATH=$FABRIC_HOME/bin:$PATH; \
  export CORE_PEER_TLS_ENABLED=true; export CORE_PEER_MSPCONFIGPATH=$HOME/peer1/msp; \
  export CORE_PEER_ADDRESS=localhost:8051; peer lifecycle chaincode install /tmp/'"${CC_NAME}.tgz"

PKGID=$(peer lifecycle chaincode queryinstalled | awk -v L="$LABEL" '$0~L{print $3}' | sed 's/,$//')

peer lifecycle chaincode approveformyorg -o vm1-orderer1:7050 --tls --cafile "$ORDERER_CA" \
  --channelID "$CHAN" --name "$CC_NAME" --version 1 --package-id "$PKGID" --sequence 1

peer lifecycle chaincode commit -o vm1-orderer1:7050 --tls --cafile "$ORDERER_CA" \
  --channelID "$CHAN" --name "$CC_NAME" --version 1 --sequence 1 \
  --peerAddresses vm2:7051 --tlsRootCertFiles "$P0_TLS" \
  --peerAddresses vm3:8051 --tlsRootCertFiles "$P1_TLS"

peer lifecycle chaincode querycommitted --channelID "$CHAN" --name "$CC_NAME"
echo "✅ ${CC_NAME} deployed to ${CHAN}"
