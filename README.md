# ShyftScripts
This repository contains various scripts for the Shyft Network.

### general installation
1. `$ npm install`
2. run scripts based on **usage** (below)

## usage [ Shyft v2 Token Upgrade process ]
1. modify .env file (use .envStructure as a basis for the fields).
2. choose **either** a local rpc provider ("ETH_PROVIDER_URL") **or** leave this blank and enter the appropriate Ethereum Network Infura api key ("INFURA_API_KEY")
3. input your private key "ASSET_PRIVATE_KEY" that you'd like to upgrade the tokens from v1 to v2 with.
4. make sure that the wei price for gas ("DEFAULT_GAS_PRICE") is set to something reasonable for the time.   
3. run: `$ node ./ShyftV2Upgrade/shyft_upgrade_v2.js`

### notes on Gas Price
gas price is is defined in WEI
online conversion utility at: https://eth-converter.com/

here's a website that you can find the *current* gas prices, to enter into the environment
variable file: https://etherscan.io/gastracker


