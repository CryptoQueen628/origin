module.exports = Object.freeze({
  IPFS_API_URL: process.env.IPFS_API_URL || 'http://127.0.0.1:5002',
  IPFS_GATEWAY_URL: process.env.IPFS_GATEWAY_URL || 'http://127.0.0.1:9090',
  IPFS_PROXY_PORT: process.env.IPFS_PROXY_PORT || 9999,
  IPFS_PROXY_ADDRESS: process.env.IPFS_PROXY_ADDRESS || '0.0.0.0',
  IPFS_SHORT_CIRCUIT: process.env.IPFS_SHORT_CIRCUIT,
  IPFS_SHORT_CIRCUIT_DIR: process.env.IPFS_SHORT_CIRCUT_DIR || '/tmp/ipfsSC'
})
