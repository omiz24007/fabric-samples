# Fabric CLI
export FABRIC_HOME="$HOME/fabric"
export PATH="$FABRIC_HOME/bin:$PATH"

# Orderer TLS CA
export ORDERER_CA=$(ls "$HOME/orderer/tls/tlscacerts/"*.pem)

# Peers の TLS CA（VM3/VM4はSSHでパス解決）
export P0_TLS=$(ls "$HOME/peer0/tls/tlscacerts/"*.pem)
export P1_TLS=$(ssh -o StrictHostKeyChecking=no fabric@vm3 'ls $HOME/peer1/tls/tlscacerts/*.pem' 2>/dev/null || true)
export P2_TLS=$(ssh -o StrictHostKeyChecking=no fabric@vm4 'ls $HOME/peer2/tls/tlscacerts/*.pem' 2>/dev/null || true)
