# Chainlink Local Node

This repo contains scripts to set up a chainlink node locally. It aims to make it easy to get started with chainlink. The script sets up postgres, chainlink node and a local ethereum node (ganache client) in docker. It deploys a mock chainlink token and a chainlink oracle to the local etherem client. The scripts will also fund the chainlink node and a deployer address with eth and link tokens. 

# Dependencies

- Docker
- Docker compose
- Node js

## Quick Start

- Clone this repository and cd into it
- It is ***recommended*** that you update the values of `testAddress` and `mnemonic` in the `.chainlink-local/config.json` file. 
- run `npm install` to install the necessary nodejs dependencies.
- run `npm start` to start all deployment and node configuration.
- After a successful set up, chainlink node will be accessible on port 6688, postgres on port 6689 and ganache on port 6690.

Notes
- The `testAddress` can be an address from your metamask extension. If no `testAddress` is specified, the address generated from the mnemonic phrase will be used as the `testAddress`. The purpose of a testAddress is to get credited with the tokens that will be issued during deployment.

The deploying account and the node addresses are derived from the `mnemonic`. An ecrypted `keystore.json` with the same string as in the `.chainlink/.password` is used as the node address. Remember to update accordingly. 